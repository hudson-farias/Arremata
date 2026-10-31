from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Session
from database.bids import BidsORM

RECENT_LIMIT = 20
TWO_MINUTES = timedelta(minutes = 2)


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


async def recent_bids(lot_id: int, db: AsyncSession | None = None, limit: int | None = RECENT_LIMIT) -> list[dict]:
    stmt = (
        select(BidsORM.amount_cents, BidsORM.created_at, BidsORM.bidder_id)
        .where(BidsORM.lot_id == lot_id)
        .order_by(BidsORM.created_at.desc(), BidsORM.id.desc())
    )

    if limit is not None:
        stmt = stmt.limit(limit)

    if db is not None:
        rows = (await db.execute(stmt)).all()
    else:
        async with Session() as opened:
            rows = (await opened.execute(stmt)).all()

    return [
        {
            'amount': int(amount),
            'created_at': aware(created_at),
            'bidder': int(bidder_id),
        }
        for amount, created_at, bidder_id in rows
    ]


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
    history = await recent_bids(lot.id, db, bid_limit) if include_bids else []

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
    }
