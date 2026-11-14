from datetime import datetime, timezone
from hashlib import sha256
from hmac import compare_digest, new as hmac_new
from typing import Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

import env
from database.bids import BidsORM
from database.lots import LotsORM
from database.settlements import SettlementsORM


def chain_timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        value = value.replace(tzinfo = timezone.utc)
    else:
        value = value.astimezone(timezone.utc)

    return value.isoformat(timespec = 'microseconds')


def genesis_message(
    lot_id: int,
    minimum_bid_cents: int,
    increment_cents: int,
    starts_at: datetime,
) -> str:
    return (
        f'lot|{int(lot_id)}|{int(minimum_bid_cents)}|{int(increment_cents)}|'
        f'{chain_timestamp(starts_at)}'
    )


def bid_message(
    lot_id: int,
    position: int,
    bidder_id: int,
    nickname: str,
    amount_cents: int,
    created_at: datetime,
    prev_hash: str,
    ends_at: datetime,
) -> str:
    return (
        f'{int(lot_id)}|{int(position)}|{int(bidder_id)}|{nickname}|{int(amount_cents)}|'
        f'{chain_timestamp(created_at)}|{prev_hash}|{chain_timestamp(ends_at)}'
    )


def sign(message: str) -> str:
    secret = env.AUDIT_SECRET

    if not secret:
        raise RuntimeError('Variáveis de ambiente ausentes: AUDIT_SECRET')

    return hmac_new(secret.encode('utf-8'), message.encode('utf-8'), sha256).hexdigest()


def same_digest(left, right) -> bool:
    if not isinstance(left, str) or not isinstance(right, str) or len(left) != len(right):
        return False

    return compare_digest(left, right)


def _winner(value) -> int | None:
    if value is None:
        return None

    return int(value)


def _settlement_agrees(settlement, head: str, winner_id: int | None, amount_cents: int) -> bool:
    if settlement is None:
        return True

    stored_winner = _winner(settlement.get('winner_id'))

    return (
        same_digest(settlement.get('chain_head'), head)
        and stored_winner == winner_id
        and int(settlement['amount_cents']) == int(amount_cents)
    )


def assess_chain(
    *,
    lot_id: int,
    minimum_bid_cents: int,
    increment_cents: int,
    starts_at: datetime,
    bids: list[dict],
    settlement: dict | None,
) -> tuple[bool, str]:
    genesis = sign(genesis_message(lot_id, minimum_bid_cents, increment_cents, starts_at))

    if not bids:
        return _settlement_agrees(settlement, genesis, None, 0), genesis

    ordered = sorted(bids, key = lambda bid: (int(bid['position']), int(bid['id'])))
    intact = [int(bid['position']) for bid in ordered] == list(range(1, len(ordered) + 1))
    previous = genesis

    for bid in ordered:
        stored_prev = bid['prev_hash'] if isinstance(bid['prev_hash'], str) else ''
        stored_hash = bid['hash'] if isinstance(bid['hash'], str) else ''

        if not same_digest(stored_prev, previous):
            intact = False

        nickname = bid['nickname'] if isinstance(bid.get('nickname'), str) else ''
        expected = sign(bid_message(
            lot_id,
            int(bid['position']),
            int(bid['bidder_id']),
            nickname,
            int(bid['amount_cents']),
            bid['created_at'],
            stored_prev,
            bid['ends_at'],
        ))

        if not same_digest(stored_hash, expected):
            intact = False

        previous = stored_hash

    last = ordered[-1]
    head = last['hash'] if isinstance(last['hash'], str) else ''

    if not _settlement_agrees(settlement, head, _winner(last['bidder_id']), int(last['amount_cents'])):
        intact = False

    return intact, head


def resign_bid_rows(
    *,
    lot_id: int,
    minimum_bid_cents: int,
    increment_cents: int,
    starts_at: datetime,
    bids: list[dict],
) -> tuple[list[dict], str]:
    previous = sign(genesis_message(lot_id, minimum_bid_cents, increment_cents, starts_at))
    ordered = sorted(bids, key = lambda bid: (int(bid['position']), int(bid['id'])))
    updated: list[dict] = []

    for bid in ordered:
        digest = sign(bid_message(
            lot_id,
            int(bid['position']),
            int(bid['bidder_id']),
            bid['nickname'] if isinstance(bid.get('nickname'), str) else '',
            int(bid['amount_cents']),
            bid['created_at'],
            previous,
            bid['ends_at'],
        ))
        row = dict(bid)
        row['prev_hash'] = previous
        row['hash'] = digest
        updated.append(row)
        previous = digest

    return updated, previous


async def find_broken_lot_ids(
    db: AsyncSession,
    lot_ids: Sequence[int] | None = None,
) -> list[int]:
    lots = await _load_lots(db, lot_ids)
    broken: list[int] = []

    for lot_id, lot in lots.items():
        bids = await _load_bid_dicts(db, [lot_id])
        settlement = await _load_settlement_dict(db, lot_id)
        intact, _head = assess_chain(
            lot_id = lot_id,
            minimum_bid_cents = int(lot['minimum_bid']),
            increment_cents = int(lot['increment_cents']),
            starts_at = lot['starts_at'],
            bids = bids,
            settlement = settlement,
        )

        if not intact:
            broken.append(lot_id)

    return broken


async def resign_lots(
    db: AsyncSession,
    lot_ids: Sequence[int] | None = None,
) -> dict[str, int]:
    if not env.AUDIT_SECRET:
        raise RuntimeError('Variáveis de ambiente ausentes: AUDIT_SECRET')

    lots = await _load_lots(db, lot_ids)
    bid_rows = await _load_bid_dicts(db, list(lots) if lot_ids is not None else None)
    by_lot: dict[int, list[dict]] = {}

    for row in bid_rows:
        by_lot.setdefault(int(row['lot_id']), []).append(row)

    heads: dict[int, str] = {}
    bids_touched = 0
    lots_touched: set[int] = set()

    for lot_id, bids in by_lot.items():
        lot = lots.get(lot_id)

        if lot is None:
            raise RuntimeError(f'lote ausente ao assinar lances: {lot_id}')

        updated, head = resign_bid_rows(
            lot_id = lot_id,
            minimum_bid_cents = int(lot['minimum_bid']),
            increment_cents = int(lot['increment_cents']),
            starts_at = lot['starts_at'],
            bids = bids,
        )
        heads[lot_id] = head

        for row in updated:
            await db.execute(
                update(BidsORM)
                .where(BidsORM.id == int(row['id']))
                .values(prev_hash = row['prev_hash'], hash = row['hash'])
            )
            bids_touched += 1

        lots_touched.add(lot_id)

    settlement_stmt = select(SettlementsORM.id, SettlementsORM.lot_id).order_by(SettlementsORM.id.asc())

    if lot_ids is not None:
        settlement_stmt = settlement_stmt.where(SettlementsORM.lot_id.in_(list(lot_ids)))

    settlements_touched = 0

    for row in (await db.execute(settlement_stmt)).mappings().all():
        lot_id = int(row['lot_id'])

        if lot_id in heads:
            head = heads[lot_id]
        else:
            lot = lots.get(lot_id)

            if lot is None:
                raise RuntimeError(f'lote ausente ao assinar liquidação: {lot_id}')

            head = sign(genesis_message(
                lot_id,
                int(lot['minimum_bid']),
                int(lot['increment_cents']),
                lot['starts_at'],
            ))

        await db.execute(
            update(SettlementsORM)
            .where(SettlementsORM.id == int(row['id']))
            .values(chain_head = head)
        )
        settlements_touched += 1
        lots_touched.add(lot_id)

    return {
        'lots': len(lots_touched),
        'bids': bids_touched,
        'settlements': settlements_touched,
    }


async def _load_lots(
    db: AsyncSession,
    lot_ids: Sequence[int] | None,
) -> dict[int, dict]:
    stmt = select(
        LotsORM.id,
        LotsORM.minimum_bid,
        LotsORM.increment_cents,
        LotsORM.starts_at,
    ).order_by(LotsORM.id.asc())

    if lot_ids is not None:
        stmt = stmt.where(LotsORM.id.in_(list(lot_ids)))

    rows = (await db.execute(stmt)).mappings().all()
    return {
        int(row['id']): {
            'minimum_bid': int(row['minimum_bid']),
            'increment_cents': int(row['increment_cents']),
            'starts_at': row['starts_at'],
        }
        for row in rows
    }


async def _load_bid_dicts(
    db: AsyncSession,
    lot_ids: Sequence[int] | None,
) -> list[dict]:
    stmt = (
        select(
            BidsORM.id,
            BidsORM.lot_id,
            BidsORM.bidder_id,
            BidsORM.amount_cents,
            BidsORM.created_at,
            BidsORM.ends_at,
            BidsORM.position,
            BidsORM.nickname,
            BidsORM.prev_hash,
            BidsORM.hash,
        )
        .order_by(BidsORM.lot_id.asc(), BidsORM.position.asc(), BidsORM.id.asc())
    )

    if lot_ids is not None:
        stmt = stmt.where(BidsORM.lot_id.in_(list(lot_ids)))

    rows = (await db.execute(stmt)).mappings().all()
    return [
        {
            'id': int(row['id']),
            'lot_id': int(row['lot_id']),
            'bidder_id': int(row['bidder_id']),
            'amount_cents': int(row['amount_cents']),
            'created_at': row['created_at'],
            'ends_at': row['ends_at'],
            'position': int(row['position']),
            'nickname': row['nickname'],
            'prev_hash': row['prev_hash'],
            'hash': row['hash'],
        }
        for row in rows
    ]


async def _load_settlement_dict(db: AsyncSession, lot_id: int) -> dict | None:
    row = (
        await db.execute(
            select(
                SettlementsORM.chain_head,
                SettlementsORM.winner_id,
                SettlementsORM.amount_cents,
            ).where(SettlementsORM.lot_id == lot_id)
        )
    ).mappings().one_or_none()

    if row is None:
        return None

    return {
        'chain_head': row['chain_head'],
        'winner_id': row['winner_id'],
        'amount_cents': int(row['amount_cents']),
    }
