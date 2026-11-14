from logging import getLogger

from sqlalchemy import exists, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import Session, Transaction
from database.bids import BidsORM
from database.lots import LotsORM
from database.settlements import SettlementsORM
from database.users import MAX_BALANCE_CENTS, UsersORM
from services.chain import genesis_message, sign
from services.lots import aware, now_utc


log = getLogger(__name__)


async def settle_due() -> list[int]:
    moment = now_utc()

    async with Session() as db:
        due_ids = await _due_lot_ids(db, moment)

    settled: list[int] = []

    for lot_id in due_ids:
        settled_id = await _settle_one(lot_id, moment)

        if settled_id is not None:
            settled.append(settled_id)

    return settled


async def settlement_for(lot_id: int, db: AsyncSession | None = None) -> dict | None:
    stmt = select(SettlementsORM).where(SettlementsORM.lot_id == lot_id)

    if db is not None:
        row = (await db.execute(stmt)).scalars().first()
    else:
        async with Session() as opened:
            row = (await opened.execute(stmt)).scalars().first()

    if row is None:
        return None

    winner = row.winner_id

    return {
        'winner': None if winner is None else int(winner),
        'amount': int(row.amount_cents),
        'seller_id': int(row.seller_id),
        'settled_at': aware(row.created_at),
        'chain_head': row.chain_head,
    }


async def _due_lot_ids(db: AsyncSession, moment) -> list[int]:
    pending = ~exists(
        select(SettlementsORM.id).where(SettlementsORM.lot_id == LotsORM.id)
    )
    stmt = (
        select(LotsORM.id)
        .where(LotsORM.cancelled_at.is_(None))
        .where(LotsORM.ends_at <= moment)
        .where(pending)
        .order_by(LotsORM.id.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [int(lot_id) for lot_id in rows]


async def _settle_one(lot_id: int, moment) -> int | None:
    async with Transaction() as tx:
        try:
            outcome = await _settle_lot(tx, lot_id, moment)

            if outcome is None:
                await tx.rollback()
                return None

            lot, winner_id = outcome
            await tx.commit()
        except IntegrityError:
            await tx.rollback()
            log.warning('liquidação duplicada do lote %s', lot_id)
            return None
        except Exception:
            await tx.rollback()
            log.exception('falha ao liquidar o lote %s', lot_id)
            return None

        await _publish_closed(lot, winner_id)
        return int(lot.id)


async def _settle_lot(tx: Transaction, lot_id: int, moment):
    lot = await tx.lock_row(
        select(LotsORM)
        .where(LotsORM.id == lot_id)
        .where(LotsORM.cancelled_at.is_(None))
        .where(LotsORM.ends_at <= moment),
        skip_locked = True,
    )

    if lot is None:
        return None

    existing = (
        await tx.execute(
            select(SettlementsORM.id).where(SettlementsORM.lot_id == lot.id)
        )
    ).scalar_one_or_none()

    if existing is not None:
        return None

    last = (
        await tx.execute(
            select(BidsORM.bidder_id, BidsORM.amount_cents, BidsORM.hash)
            .where(BidsORM.lot_id == lot.id)
            .order_by(BidsORM.position.desc())
            .limit(1)
        )
    ).one_or_none()

    if last is None:
        winner_id = None
        amount = 0
        chain_head = sign(genesis_message(
            int(lot.id),
            int(lot.minimum_bid),
            int(lot.increment_cents),
            lot.starts_at,
        ))
    else:
        winner_id = int(last[0])
        amount = int(last[1])
        chain_head = last[2]
        moved = await _move_funds(tx, winner_id, int(lot.owner_id), amount)

        if not moved:
            log.warning('saldo incompatível na liquidação do lote %s', lot.id)
            return None

    await tx.execute(insert(SettlementsORM).values(
        lot_id = int(lot.id),
        winner_id = winner_id,
        seller_id = int(lot.owner_id),
        amount_cents = amount,
        chain_head = chain_head,
        created_at = now_utc(),
    ))
    return lot, winner_id


async def _move_funds(tx: Transaction, winner_id: int, seller_id: int, amount: int) -> bool:
    by_id = {}

    for user_id in sorted({winner_id, seller_id}):
        user = await tx.lock(UsersORM, user_id)

        if user is None:
            return False

        by_id[user_id] = user

    winner = by_id[winner_id]
    seller = by_id[seller_id]
    winner_balance = int(winner.balance_cents)
    seller_balance = int(seller.balance_cents)

    if winner_balance < amount:
        return False

    if winner_id == seller_id:
        resulting = winner_balance
    else:
        resulting = seller_balance + amount

    if resulting > MAX_BALANCE_CENTS:
        return False

    if winner_id != seller_id:
        winner.balance_cents = winner_balance - amount
        seller.balance_cents = seller_balance + amount
        await tx.db.flush()

    return True


async def _publish_closed(lot, winner_id: int | None) -> None:
    from services.live import publish_lot
    from services.lots import public_lot

    try:
        payload = await public_lot(lot, include_bids = True)
        await publish_lot(int(lot.id), payload, winner_id)
    except Exception:
        log.exception('falha ao publicar liquidação do lote %s', lot.id)
