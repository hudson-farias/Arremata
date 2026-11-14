from secrets import choice

from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import Session
from database.aliases import LotAliasesORM
from database.bids import BidsORM


ATTEMPTS = 8

# Protagonistas, rivais e campeões dos jogos. Sem o anime.
TRAINERS = (
    'red', 'leaf', 'ethan', 'lyra', 'brendan', 'may', 'lucas', 'dawn',
    'hilbert', 'hilda', 'nate', 'rosa', 'calem', 'serena', 'elio', 'selene',
    'victor', 'gloria', 'rei', 'akari', 'florian', 'juliana',
    'blue', 'silver', 'wally', 'barry', 'cheren', 'bianca', 'hugh', 'shauna',
    'hau', 'gladion', 'hop', 'marnie', 'bede', 'nemona', 'arven', 'penny',
    'trace', 'kieran',
    'lance', 'steven', 'wallace', 'cintia', 'alder', 'iris', 'diantha',
    'kukui', 'leon', 'geeta', 'mustard',
)

POKEMON = (
    'pikachu', 'charizard', 'blastoise', 'venusaur', 'garchomp', 'lucario', 'gengar', 'snorlax',
    'dragonite', 'tyranitar', 'metagross', 'salamence', 'gardevoir', 'milotic', 'absol', 'flygon',
    'swampert', 'sceptile', 'blaziken', 'infernape', 'empoleon', 'torterra', 'luxray', 'staraptor',
    'togekiss', 'gliscor', 'weavile', 'mamoswine', 'electivire', 'magmortar', 'rhyperior', 'tangrowth',
    'leafeon', 'glaceon', 'sylveon', 'umbreon', 'espeon', 'vaporeon', 'jolteon', 'flareon',
    'hydreigon', 'volcarona', 'chandelure', 'haxorus', 'excadrill', 'zoroark', 'greninja', 'talonflame',
    'aegislash', 'goodra', 'noivern', 'decidueye', 'incineroar', 'primarina', 'mimikyu', 'lycanroc',
    'toxapex', 'lunala', 'solgaleo', 'zeraora', 'melmetal', 'corviknight', 'dragapult', 'grimmsnarl',
    'hatterene', 'coalossal', 'centiskorch', 'morpeko', 'spectrier', 'glastrier', 'urshifu', 'meowscarada',
    'skeledirge', 'quaquaval', 'annihilape', 'kingambit', 'baxcalibur', 'tinkaton', 'ceruledge', 'gholdengo',
)


def draw_nickname() -> str:
    return f'{choice(TRAINERS)}-{choice(POKEMON)}'


def stable_nickname(lot_id: int, user_id: int, taken: set[str]) -> str:
    span = len(TRAINERS) * len(POKEMON)
    seed = (int(lot_id) * 1000003 + int(user_id)) % span

    for step in range(span):
        index = (seed + step) % span
        nickname = f'{TRAINERS[index % len(TRAINERS)]}-{POKEMON[index // len(TRAINERS)]}'

        if nickname not in taken:
            return nickname

    raise RuntimeError('não foi possível gerar o apelido')


async def allocate(read, write, draw = None) -> str:
    pick = draw_nickname if draw is None else draw
    current = await read()

    if current is not None:
        return current

    for _ in range(ATTEMPTS):
        nickname = pick()

        try:
            await write(nickname)
        except IntegrityError:
            current = await read()

            if current is not None:
                return current

            continue

        return nickname

    from services.bids import BidError

    raise BidError(409, 'não foi possível gerar o apelido')


async def read_alias(db: AsyncSession, lot_id: int, user_id: int) -> str | None:
    nickname = (
        await db.execute(
            select(LotAliasesORM.nickname)
            .where(LotAliasesORM.lot_id == lot_id)
            .where(LotAliasesORM.user_id == user_id)
        )
    ).scalar_one_or_none()

    return None if nickname is None else str(nickname)


async def ensure_alias(db: AsyncSession, lot_id: int, user_id: int) -> str:
    async def read() -> str | None:
        return await read_alias(db, lot_id, user_id)

    async def write(nickname: str) -> None:
        async with db.begin_nested():
            await db.execute(insert(LotAliasesORM).values(
                lot_id = lot_id,
                user_id = user_id,
                nickname = nickname,
            ))

    return await allocate(read, write)


async def nickname_of(lot_id: int, user_id: int, db: AsyncSession | None = None) -> str | None:
    async def lookup(session: AsyncSession) -> str | None:
        found = await read_alias(session, lot_id, user_id)

        if found is not None:
            return found

        nickname = (
            await session.execute(
                select(BidsORM.nickname)
                .where(BidsORM.lot_id == lot_id)
                .where(BidsORM.bidder_id == user_id)
                .limit(1)
            )
        ).scalar_one_or_none()

        return None if nickname is None else str(nickname)

    if db is not None:
        return await lookup(db)

    async with Session() as opened:
        return await lookup(opened)


async def nicknames_for_user(db: AsyncSession, user_id: int, lot_ids: list[int]) -> dict[int, str]:
    if not lot_ids:
        return {}

    found: dict[int, str] = {}
    rows = (
        await db.execute(
            select(LotAliasesORM.lot_id, LotAliasesORM.nickname)
            .where(LotAliasesORM.user_id == user_id)
            .where(LotAliasesORM.lot_id.in_(lot_ids))
        )
    ).all()

    for lot_id, nickname in rows:
        found[int(lot_id)] = str(nickname)

    missing = [lot_id for lot_id in lot_ids if lot_id not in found]

    if not missing:
        return found

    bids = (
        await db.execute(
            select(BidsORM.lot_id, BidsORM.nickname)
            .where(BidsORM.bidder_id == user_id)
            .where(BidsORM.lot_id.in_(missing))
        )
    ).all()

    for lot_id, nickname in bids:
        found.setdefault(int(lot_id), str(nickname))

    return found
