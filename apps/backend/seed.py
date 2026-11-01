import asyncio
from datetime import timedelta

from sqlalchemy import insert, select

from database import Session, engine
from database.bids import BidsORM
from database.lots import LotsORM
from database.settlements import SettlementsORM
from database.users import UsersORM
from services.chain import bid_message, genesis_message, sign
from services.lots import aware, now_utc


PASSWORD = 'leilao123'
AUCTIONEER_EMAIL = 'leiloeiro@arremata.dev'
ANA_EMAIL = 'ana@arremata.dev'
BRUNO_EMAIL = 'bruno@arremata.dev'

CLOSED_MINIMUM = 50000
CLOSED_INCREMENT = 10000
WINNING_AMOUNT = CLOSED_MINIMUM + (2 * CLOSED_INCREMENT)

LIVE_MINIMUM = 20000
LIVE_INCREMENT = 5000
LIVE_LEADING = LIVE_MINIMUM + LIVE_INCREMENT

# Saldos já finais, como se a liquidação tivesse debitado a Ana e creditado o leiloeiro.
AUCTIONEER_BALANCE = WINNING_AMOUNT
ANA_BALANCE = 30000
BRUNO_BALANCE = 150000


def _card(card_id, title, number, rarity, minimum_bid, increment_cents):
    return {
        'card_id': card_id,
        'title': title,
        'image_url': f'https://images.pokemontcg.io/{card_id.replace("-", "/")}_hires.png',
        'attributes': {
            'set_name': 'Base',
            'rarity': rarity,
            'number': number,
        },
        'minimum_bid': minimum_bid,
        'increment_cents': increment_cents,
    }


CHARIZARD = _card('base1-4', 'Charizard', '4', 'Rare Holo', 150000, 10000)
PIKACHU = _card('base1-58', 'Pikachu', '58', 'Common', LIVE_MINIMUM, LIVE_INCREMENT)
BLASTOISE = _card('base1-2', 'Blastoise', '2', 'Rare Holo', CLOSED_MINIMUM, CLOSED_INCREMENT)
VENUSAUR = _card('base1-15', 'Venusaur', '15', 'Rare Holo', 10000, 5000)
MEWTWO = _card('base1-10', 'Mewtwo', '10', 'Rare Holo', 80000, 10000)


def _window(steps, starts_at, ends_at):
    previous_amount = None
    previous_at = None

    for _bidder_id, amount_cents, created_at in steps:
        created_at = aware(created_at)

        if not (starts_at < created_at < ends_at):
            raise RuntimeError('lance fora da janela do lote')

        if previous_amount is not None and amount_cents <= previous_amount:
            raise RuntimeError('lances do mesmo lote precisam ser estritamente crescentes')

        if previous_at is not None and created_at <= previous_at:
            raise RuntimeError('horários dos lances precisam ser crescentes')

        previous_amount = amount_cents
        previous_at = created_at


async def _user(db, email, password_hash, balance_cents):
    user_id = (
        await db.execute(
            insert(UsersORM).values(
                email = email,
                password = password_hash,
                balance_cents = balance_cents,
            ).returning(UsersORM.id)
        )
    ).scalar_one()
    return int(user_id)


async def _lot(db, owner_id, card, starts_at, ends_at, cancelled_at = None):
    starts_at = aware(starts_at)
    ends_at = aware(ends_at)

    if ends_at <= starts_at:
        raise RuntimeError('fim do lote precisa ser depois do início')

    if card['increment_cents'] <= 0 or card['minimum_bid'] <= 0:
        raise RuntimeError('lance inicial e incremento precisam ser maiores que zero')

    lot_id = (
        await db.execute(
            insert(LotsORM).values(
                owner_id = owner_id,
                card_id = card['card_id'],
                title = card['title'],
                image_url = card['image_url'],
                attributes = card['attributes'],
                starts_at = starts_at,
                ends_at = ends_at,
                minimum_bid = card['minimum_bid'],
                increment_cents = card['increment_cents'],
                cancelled_at = None if cancelled_at is None else aware(cancelled_at),
            ).returning(LotsORM.id)
        )
    ).scalar_one()
    await db.flush()
    return int(lot_id), starts_at, ends_at


async def _bids(db, lot_id, card, starts_at, ends_at, steps):
    _window(steps, starts_at, ends_at)
    prev_hash = sign(genesis_message(
        lot_id,
        card['minimum_bid'],
        card['increment_cents'],
        starts_at,
    ))
    position = 1
    head = prev_hash

    for bidder_id, amount_cents, created_at in steps:
        created_at = aware(created_at)
        digest = sign(bid_message(
            lot_id,
            position,
            bidder_id,
            amount_cents,
            created_at,
            prev_hash,
        ))
        await db.execute(insert(BidsORM).values(
            lot_id = lot_id,
            bidder_id = bidder_id,
            amount_cents = amount_cents,
            created_at = created_at,
            position = position,
            prev_hash = prev_hash,
            hash = digest,
        ))
        prev_hash = digest
        head = digest
        position += 1

    return head


async def _settle(db, lot_id, seller_id, winner_id, amount_cents, chain_head, created_at):
    await db.execute(insert(SettlementsORM).values(
        lot_id = lot_id,
        winner_id = winner_id,
        seller_id = seller_id,
        amount_cents = amount_cents,
        chain_head = chain_head,
        created_at = aware(created_at),
    ))


def _report(created):
    print('Seed gravada.')
    print(AUCTIONEER_EMAIL)
    print(ANA_EMAIL)
    print(BRUNO_EMAIL)
    print(f'Senha: {PASSWORD}')

    for lot_id, title in created:
        print(f'{lot_id} {title}')


async def seed():
    if ANA_BALANCE <= 0 or BRUNO_BALANCE <= LIVE_LEADING or AUCTIONEER_BALANCE != WINNING_AMOUNT:
        raise RuntimeError('saldos finais incompatíveis com os lances')

    async with Session() as db:
        existing = (
            await db.execute(
                select(UsersORM.id).where(UsersORM.email == AUCTIONEER_EMAIL)
            )
        ).scalar_one_or_none()

        if existing is not None:
            print(f'{AUCTIONEER_EMAIL} já existe. Nada foi gravado.')
            return

        moment = aware(now_utc())
        passwords = UsersORM()
        auctioneer_id = await _user(
            db,
            AUCTIONEER_EMAIL,
            passwords.hash_password(PASSWORD),
            AUCTIONEER_BALANCE,
        )
        ana_id = await _user(
            db,
            ANA_EMAIL,
            passwords.hash_password(PASSWORD),
            ANA_BALANCE,
        )
        bruno_id = await _user(
            db,
            BRUNO_EMAIL,
            passwords.hash_password(PASSWORD),
            BRUNO_BALANCE,
        )

        created = []

        scheduled_start = aware(moment + timedelta(days = 2))
        scheduled_end = aware(moment + timedelta(days = 3))
        scheduled_id, _scheduled_start, _scheduled_end = await _lot(
            db, auctioneer_id, CHARIZARD, scheduled_start, scheduled_end,
        )
        created.append((scheduled_id, CHARIZARD['title']))

        live_start = aware(moment - timedelta(hours = 1))
        live_end = aware(moment + timedelta(hours = 2))
        live_id, live_starts, live_ends = await _lot(
            db, auctioneer_id, PIKACHU, live_start, live_end,
        )
        live_steps = (
            (ana_id, LIVE_MINIMUM, aware(live_starts + timedelta(minutes = 15))),
            (bruno_id, LIVE_LEADING, aware(live_starts + timedelta(minutes = 40))),
        )
        await _bids(db, live_id, PIKACHU, live_starts, live_ends, live_steps)
        created.append((live_id, PIKACHU['title']))

        won_start = aware(moment - timedelta(days = 2))
        won_end = aware(moment - timedelta(days = 1))
        won_id, won_starts, won_ends = await _lot(
            db, auctioneer_id, BLASTOISE, won_start, won_end,
        )
        won_steps = (
            (ana_id, CLOSED_MINIMUM, aware(won_starts + timedelta(hours = 2))),
            (bruno_id, CLOSED_MINIMUM + CLOSED_INCREMENT, aware(won_starts + timedelta(hours = 8))),
            (ana_id, WINNING_AMOUNT, aware(won_starts + timedelta(hours = 18))),
        )
        won_head = await _bids(db, won_id, BLASTOISE, won_starts, won_ends, won_steps)
        await _settle(db, won_id, auctioneer_id, ana_id, WINNING_AMOUNT, won_head, won_ends)
        created.append((won_id, BLASTOISE['title']))

        empty_end = aware(moment - timedelta(hours = 4))
        empty_start = aware(empty_end - timedelta(hours = 6))
        empty_id, empty_starts, empty_ends = await _lot(
            db, auctioneer_id, VENUSAUR, empty_start, empty_end,
        )
        empty_head = sign(genesis_message(
            empty_id,
            VENUSAUR['minimum_bid'],
            VENUSAUR['increment_cents'],
            empty_starts,
        ))
        await _settle(db, empty_id, auctioneer_id, None, 0, empty_head, empty_ends)
        created.append((empty_id, VENUSAUR['title']))

        cancelled_start = aware(moment - timedelta(hours = 2))
        cancelled_end = aware(moment + timedelta(hours = 6))
        cancelled_at = aware(moment - timedelta(minutes = 30))
        cancelled_id, _cancelled_start, _cancelled_end = await _lot(
            db,
            auctioneer_id,
            MEWTWO,
            cancelled_start,
            cancelled_end,
            cancelled_at,
        )
        created.append((cancelled_id, MEWTWO['title']))

        await db.commit()

    _report(created)


async def main():
    try:
        await seed()
    finally:
        await engine.dispose()


if __name__ == '__main__':
    asyncio.run(main())
