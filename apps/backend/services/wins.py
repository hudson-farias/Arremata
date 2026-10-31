from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Session
from database.bids import BidsORM
from database.lots import LotsORM
from database.settlements import SettlementsORM
from services.lots import attributes_of, aware, now_utc, status_of


_STATUS_RANK = {'live': 0, 'scheduled': 1, 'closed': 2}


def _position(status: str, leading: bool) -> str:
    if status == 'closed':
        return 'lost'

    if leading:
        return 'winning'

    return 'outbid'


def _card(lot) -> dict:
    attributes = attributes_of(lot)

    return {
        'id': int(lot.id),
        'title': lot.title,
        'image_url': lot.image_url,
        'set_name': attributes.get('set_name'),
        'rarity': attributes.get('rarity'),
        'number': attributes.get('number'),
    }


async def wins_for(user_id: int, db: AsyncSession | None = None) -> dict:
    if db is None:
        async with Session() as opened:
            return await _collect(opened, user_id)

    return await _collect(db, user_id)


async def _collect(db: AsyncSession, user_id: int) -> dict:
    moment = now_utc()
    mine = (
        select(
            BidsORM.lot_id.label('lot_id'),
            func.max(BidsORM.amount_cents).label('user_bid'),
        )
        .where(BidsORM.bidder_id == user_id)
        .group_by(BidsORM.lot_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(LotsORM, mine.c.user_bid)
            .join(mine, mine.c.lot_id == LotsORM.id)
            .where(LotsORM.cancelled_at.is_(None))
        )
    ).all()

    if not rows:
        return {'won': [], 'bids': []}

    lot_ids = [int(lot.id) for lot, _user_bid in rows]
    summaries = await _summaries(db, lot_ids)
    leaders = await _leaders(db, lot_ids)
    settlements = await _settlements(db, lot_ids)
    won = []
    bids = []

    for lot, user_bid in rows:
        lot_id = int(lot.id)
        status = status_of(lot, moment)
        count, current = summaries.get(lot_id, (0, None))
        leader = leaders.get(lot_id)
        user_amount = int(user_bid)
        card = _card(lot)

        if status == 'closed' and _is_winner(user_id, settlements.get(lot_id), leader):
            won.append({
                **card,
                'amount': _won_amount(settlements.get(lot_id), current, user_amount),
                'settled_at': _settled_at(lot, settlements.get(lot_id)),
                'winner': user_id,
            })
            continue

        bids.append({
            **card,
            'status': status,
            'position': _position(status, leader == user_id),
            'current_bid': current,
            'user_bid': user_amount,
            'ends_at': aware(lot.ends_at),
            'bid_count': count,
        })

    won.sort(key = lambda item: (item['settled_at'], item['id']), reverse = True)
    bids.sort(key = lambda item: (_STATUS_RANK[item['status']], item['ends_at'], item['id']))
    return {'won': won, 'bids': bids}


def _is_winner(user_id: int, settlement, leader: int | None) -> bool:
    if settlement is not None and settlement.winner_id is not None:
        return int(settlement.winner_id) == user_id

    return leader == user_id


def _won_amount(settlement, current: int | None, user_amount: int) -> int:
    if settlement is not None and settlement.winner_id is not None:
        return int(settlement.amount_cents)

    if current is not None:
        return int(current)

    return user_amount


def _settled_at(lot, settlement):
    if settlement is not None:
        return aware(settlement.created_at)

    return aware(lot.ends_at)


async def _summaries(db: AsyncSession, lot_ids: list[int]) -> dict[int, tuple[int, int | None]]:
    rows = (
        await db.execute(
            select(
                BidsORM.lot_id,
                func.count(BidsORM.id),
                func.max(BidsORM.amount_cents),
            )
            .where(BidsORM.lot_id.in_(lot_ids))
            .group_by(BidsORM.lot_id)
        )
    ).all()

    return {
        int(lot_id): (int(count), None if amount is None else int(amount))
        for lot_id, count, amount in rows
    }


async def _leaders(db: AsyncSession, lot_ids: list[int]) -> dict[int, int]:
    rank = func.row_number().over(
        partition_by = BidsORM.lot_id,
        order_by = [
            BidsORM.amount_cents.desc(),
            BidsORM.created_at.asc(),
            BidsORM.id.asc(),
        ],
    )
    ranked = (
        select(
            BidsORM.lot_id.label('lot_id'),
            BidsORM.bidder_id.label('bidder_id'),
            rank.label('rn'),
        )
        .where(BidsORM.lot_id.in_(lot_ids))
        .subquery()
    )
    rows = (
        await db.execute(
            select(ranked.c.lot_id, ranked.c.bidder_id).where(ranked.c.rn == 1)
        )
    ).all()

    return {int(lot_id): int(bidder_id) for lot_id, bidder_id in rows}


async def _settlements(db: AsyncSession, lot_ids: list[int]) -> dict[int, SettlementsORM]:
    rows = (
        await db.execute(
            select(SettlementsORM).where(SettlementsORM.lot_id.in_(lot_ids))
        )
    ).scalars().all()

    return {int(row.lot_id): row for row in rows}
