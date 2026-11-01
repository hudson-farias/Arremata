from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Session
from database.bids import BidsORM
from database.lots import LotsORM
from database.settlements import SettlementsORM
from services.chain import assess_chain

RECENT_LIMIT = 20
TWO_MINUTES = timedelta(minutes = 2)


class LotError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo = timezone.utc)

    return value


def status_of(lot, moment: datetime | None = None) -> str:
    if lot.cancelled_at is not None:
        return 'cancelled'

    moment = aware(moment or now_utc())
    starts_at = aware(lot.starts_at)
    ends_at = aware(lot.ends_at)

    if moment < starts_at:
        return 'scheduled'

    if moment < ends_at:
        return 'live'

    return 'closed'


def extend_ends_at(lot, moment: datetime) -> bool:
    moment = aware(moment)
    ends_at = aware(lot.ends_at)

    if ends_at - moment > TWO_MINUTES:
        return False

    lot.ends_at = ends_at + TWO_MINUTES
    return True


async def bid_summary(lot_id: int, db: AsyncSession | None = None) -> tuple[int, int | None]:
    stmt = select(
        func.count(BidsORM.id),
        func.max(BidsORM.amount_cents),
    ).where(BidsORM.lot_id == lot_id)

    if db is not None:
        count, amount = (await db.execute(stmt)).one()
    else:
        async with Session() as opened:
            count, amount = (await opened.execute(stmt)).one()

    return int(count or 0), None if amount is None else int(amount)


async def summaries_for(lot_ids: list[int]) -> dict[int, tuple[int, int | None]]:
    unique = list(dict.fromkeys(lot_ids))
    found = {lot_id: (0, None) for lot_id in unique}

    if not unique:
        return found

    stmt = (
        select(BidsORM.lot_id, func.count(BidsORM.id), func.max(BidsORM.amount_cents))
        .where(BidsORM.lot_id.in_(unique))
        .group_by(BidsORM.lot_id)
    )

    async with Session() as db:
        rows = (await db.execute(stmt)).all()

    for lot_id, count, amount in rows:
        found[int(lot_id)] = (int(count), None if amount is None else int(amount))

    return found


async def bid_count(lot) -> int:
    count, _amount = await bid_summary(lot.id)
    return count


async def current_bid(lot) -> int | None:
    _count, amount = await bid_summary(lot.id)
    return amount


async def leading_bidder(lot_id: int, db: AsyncSession | None = None) -> int | None:
    stmt = (
        select(BidsORM.bidder_id)
        .where(BidsORM.lot_id == lot_id)
        .order_by(BidsORM.amount_cents.desc(), BidsORM.created_at.asc(), BidsORM.id.asc())
        .limit(1)
    )

    if db is not None:
        bidder_id = (await db.execute(stmt)).scalar_one_or_none()
    else:
        async with Session() as opened:
            bidder_id = (await opened.execute(stmt)).scalar_one_or_none()

    return None if bidder_id is None else int(bidder_id)


def published_bid(row: dict) -> dict:
    return {
        'amount': int(row['amount_cents']),
        'created_at': aware(row['created_at']),
        'bidder': int(row['bidder_id']),
        'position': int(row['position']),
        'hash': row['hash'],
        'prev_hash': row['prev_hash'],
    }


async def load_bids(lot_id: int, db: AsyncSession | None = None) -> list[dict]:
    stmt = (
        select(
            BidsORM.id,
            BidsORM.position,
            BidsORM.amount_cents,
            BidsORM.created_at,
            BidsORM.bidder_id,
            BidsORM.prev_hash,
            BidsORM.hash,
        )
        .where(BidsORM.lot_id == lot_id)
        .order_by(BidsORM.position.asc(), BidsORM.id.asc())
    )

    if db is not None:
        rows = (await db.execute(stmt)).all()
    else:
        async with Session() as opened:
            rows = (await opened.execute(stmt)).all()

    return [
        {
            'id': int(bid_id),
            'position': int(position),
            'amount_cents': int(amount_cents),
            'created_at': created_at,
            'bidder_id': int(bidder_id),
            'prev_hash': prev_hash,
            'hash': digest,
        }
        for bid_id, position, amount_cents, created_at, bidder_id, prev_hash, digest in rows
    ]


async def _chain_settlement(lot_id: int, db: AsyncSession | None) -> dict | None:
    from services.settlement import settlement_for

    recorded = await settlement_for(lot_id, db)

    if recorded is None:
        return None

    return {
        'chain_head': recorded['chain_head'],
        'winner_id': recorded['winner'],
        'amount_cents': int(recorded['amount']),
    }


async def recent_bids(lot_id: int, db: AsyncSession | None = None, limit: int | None = RECENT_LIMIT) -> list[dict]:
    rows = await load_bids(lot_id, db)
    rows.sort(key = lambda row: (aware(row['created_at']), row['id']), reverse = True)

    if limit is not None:
        rows = rows[:limit]

    return [published_bid(row) for row in rows]


def result_of(status: str, bids: int):
    if status == 'closed' and bids == 0:
        return {'winner': None, 'amount': None}

    return None


async def result_for(status: str, bids: int, lot_id: int, db: AsyncSession | None = None):
    if status != 'closed':
        return None

    from services.settlement import settlement_for

    settlement = await settlement_for(lot_id, db)

    if settlement is not None and settlement['winner'] is not None:
        return {
            'winner': settlement['winner'],
            'amount': int(settlement['amount']),
        }

    if settlement is not None:
        return {'winner': None, 'amount': None}

    return result_of(status, bids)


def attributes_of(lot) -> dict:
    raw = lot.attributes or {}

    if isinstance(raw, str):
        from json import loads
        raw = loads(raw)

    number = raw.get('number')

    return {
        'set_name': raw.get('set_name'),
        'rarity': raw.get('rarity'),
        'number': None if number is None else str(number),
    }


async def auctioneer_lot(
    lot,
    moment: datetime | None = None,
    *,
    summary: tuple[int, int | None] | None = None,
    db: AsyncSession | None = None,
) -> dict:
    moment = aware(moment or now_utc())
    status = status_of(lot, moment)

    if summary is None:
        summary = await bid_summary(lot.id)

    bids, _amount = summary
    attributes = attributes_of(lot)

    return {
        'id': lot.id,
        'owner_id': lot.owner_id,
        'card_id': lot.card_id,
        'title': lot.title,
        'image_url': lot.image_url,
        'attributes': attributes,
        'starts_at': aware(lot.starts_at),
        'ends_at': aware(lot.ends_at),
        'minimum_bid': int(lot.minimum_bid),
        'increment': int(lot.increment_cents),
        'cancelled_at': None if lot.cancelled_at is None else aware(lot.cancelled_at),
        'status': status,
        'bid_count': bids,
        'result': await result_for(status, bids, lot.id, db),
    }


async def cancel_owned_lot(lot_id: int, owner_id: int) -> dict:
    async with Session() as db:
        lot = (
            await db.execute(
                select(LotsORM).where(LotsORM.id == lot_id).with_for_update()
            )
        ).scalars().first()

        if lot is None or lot.owner_id != owner_id:
            raise LotError(404, 'lote não encontrado')

        if lot.cancelled_at is not None:
            raise LotError(409, 'lote cancelado')

        moment = now_utc()

        if status_of(lot, moment) == 'closed':
            raise LotError(409, 'lote encerrado')

        settled = (
            await db.execute(
                select(SettlementsORM.id).where(SettlementsORM.lot_id == lot.id)
            )
        ).scalar_one_or_none()

        if settled is not None:
            raise LotError(409, 'lote encerrado')

        lot.cancelled_at = moment
        summary = await bid_summary(int(lot.id), db)
        leader_id = await leading_bidder(int(lot.id), db)
        payload = await auctioneer_lot(lot, moment, summary = summary, db = db)
        published_id = int(lot.id)
        await db.commit()

    from services.live import publish_cancelled

    await publish_cancelled(published_id, leader_id)
    return payload


async def public_lot(
    lot,
    moment: datetime | None = None,
    *,
    include_bids: bool = False,
    bid_limit: int | None = RECENT_LIMIT,
    summary: tuple[int, int | None] | None = None,
    db: AsyncSession | None = None,
) -> dict:
    moment = aware(moment or now_utc())
    status = status_of(lot, moment)

    if summary is None:
        summary = await bid_summary(lot.id, db)

    bids, amount = summary
    attributes = attributes_of(lot)
    rows = await load_bids(lot.id, db)
    intact, head = assess_chain(
        lot_id = int(lot.id),
        minimum_bid_cents = int(lot.minimum_bid),
        increment_cents = int(lot.increment_cents),
        starts_at = lot.starts_at,
        bids = rows,
        settlement = await _chain_settlement(lot.id, db),
    )
    history = []

    if include_bids:
        visible = sorted(rows, key = lambda row: (aware(row['created_at']), row['id']), reverse = True)

        if bid_limit is not None:
            visible = visible[:bid_limit]

        history = [published_bid(row) for row in visible]

    return {
        'id': lot.id,
        'title': lot.title,
        'image_url': lot.image_url,
        'minimum_bid': int(lot.minimum_bid),
        'increment': int(lot.increment_cents),
        'current_bid': amount,
        'starts_at': aware(lot.starts_at),
        'ends_at': aware(lot.ends_at),
        'status': status,
        'bid_count': bids,
        'bids': history,
        'attributes': attributes,
        'set_name': attributes.get('set_name'),
        'rarity': attributes.get('rarity'),
        'number': attributes.get('number'),
        'result': await result_for(status, bids, lot.id, db),
        'chain_intact': intact,
        'chain_head': head,
    }
