from datetime import datetime

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Session
from database.bids import BidsORM
from database.lots import LotsORM
from database.users import UsersORM
from services.live import publish_lot
from services.lots import aware, bid_summary, leading_bidder, now_utc, public_lot, status_of


class BidError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


async def committed_cents(user_id: int, moment: datetime | None = None, db: AsyncSession | None = None) -> int:
    moment = aware(moment or now_utc())
    rank = func.row_number().over(
        partition_by = BidsORM.lot_id,
        order_by = [
            BidsORM.amount_cents.desc(),
            BidsORM.created_at.asc(),
            BidsORM.id.asc(),
        ],
    )
    ranked = select(
        BidsORM.lot_id.label('lot_id'),
        BidsORM.bidder_id.label('bidder_id'),
        BidsORM.amount_cents.label('amount_cents'),
        rank.label('rn'),
    ).subquery()

    stmt = (
        select(func.coalesce(func.sum(ranked.c.amount_cents), 0))
        .select_from(ranked)
        .join(LotsORM, LotsORM.id == ranked.c.lot_id)
        .where(ranked.c.rn == 1)
        .where(ranked.c.bidder_id == user_id)
        .where(LotsORM.cancelled_at.is_(None))
        .where(LotsORM.starts_at <= moment)
        .where(LotsORM.ends_at > moment)
    )

    if db is not None:
        total = (await db.execute(stmt)).scalar_one()
    else:
        async with Session() as opened:
            total = (await opened.execute(stmt)).scalar_one()

    return int(total or 0)


async def place_bid(lot_id: int, bidder_id: int, amount: int) -> dict:
    async with Session() as db:
        db.expire_on_flush = False
        lot = (
            await db.execute(
                select(LotsORM).where(LotsORM.id == lot_id).with_for_update()
            )
        ).scalars().first()

        if lot is None:
            raise BidError(404, 'lote não encontrado')

        user = (
            await db.execute(
                select(UsersORM).where(UsersORM.id == bidder_id).with_for_update()
            )
        ).scalars().first()

        if user is None:
            raise BidError(401, 'token inválido')

        if lot.cancelled_at is not None:
            raise BidError(404, 'lote não encontrado')

        if lot.owner_id == bidder_id:
            raise BidError(403, 'não é possível dar lance no próprio lote')

        status = status_of(lot)

        if status == 'scheduled':
            raise BidError(409, 'o pregão ainda não começou')

        if status != 'live':
            raise BidError(409, 'o pregão já encerrou')

        leader = await leading_bidder(lot.id, db)

        if leader == bidder_id:
            raise BidError(409, 'você já está ganhando')

        _count, current = await bid_summary(lot.id, db)

        if current is None:
            if amount < int(lot.minimum_bid):
                raise BidError(409, 'lance abaixo do mínimo')
        elif amount < int(current) + int(lot.increment_cents):
            raise BidError(409, 'lance abaixo do mínimo')

        available = int(user.balance_cents) - await committed_cents(bidder_id, db = db)

        if available < amount:
            raise BidError(409, 'saldo insuficiente')

        await db.execute(insert(BidsORM).values(
            lot_id = lot.id,
            bidder_id = bidder_id,
            amount_cents = amount,
            created_at = now_utc(),
        ))

        payload = await public_lot(lot, include_bids = True, db = db)
        leader_id = await leading_bidder(lot.id, db)
        payload['leading'] = leader_id == bidder_id
        await db.commit()

    published = {key: value for key, value in payload.items() if key != 'leading'}
    await publish_lot(lot_id, published, leader_id)
    return payload
