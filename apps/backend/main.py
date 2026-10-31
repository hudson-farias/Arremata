from asyncio import CancelledError, create_task, sleep
from contextlib import asynccontextmanager
from importlib import import_module
from logging import getLogger
from os.path import join
from os import walk

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import exists, func, select

from database import Session
from database.lots import LotsORM
from database.settlements import SettlementsORM
from env import DOCS_PATH, REDOCS_PATH
from services.lots import aware, now_utc
from services.settlement import settle_due
from utils.rate_limit import limiter


log = getLogger(__name__)
SETTLEMENT_WAIT_SECONDS = 30


async def next_unsettled_end():
    moment = now_utc()
    settled = exists(
        select(SettlementsORM.id).where(SettlementsORM.lot_id == LotsORM.id)
    )
    stmt = (
        select(func.min(LotsORM.ends_at))
        .where(LotsORM.cancelled_at.is_(None))
        .where(LotsORM.ends_at > moment)
        .where(~settled)
    )

    async with Session() as db:
        ends_at = (await db.execute(stmt)).scalar_one()

    if ends_at is None:
        return None

    return aware(ends_at)


async def settlement_clock() -> None:
    while True:
        try:
            ends_at = await next_unsettled_end()

            if ends_at is None:
                delay = SETTLEMENT_WAIT_SECONDS
            else:
                remaining = (ends_at - now_utc()).total_seconds()
                delay = min(SETTLEMENT_WAIT_SECONDS, max(0.0, remaining))

            await sleep(delay)
            await settle_due()
        except Exception:
            log.exception('falha no relógio de liquidação')
            await sleep(SETTLEMENT_WAIT_SECONDS)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = create_task(settlement_clock())

    try:
        yield
    finally:
        task.cancel()

        try:
            await task
        except CancelledError:
            pass


app = FastAPI(docs_url = DOCS_PATH, redoc_url = REDOCS_PATH, lifespan = lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins = ['*'],
    allow_credentials = True,
    allow_methods = ['*'],
    allow_headers = ['*'],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def load(subapp: FastAPI, directory: str = 'routers'):
    import_cache = {}

    for root, _, files in walk(directory):
        for file in files:
            if not file.startswith('__') and file.endswith('.py'):
                path = join(root, file).replace('.py', '').replace('/', '.').replace('\\', '.')

                if path not in import_cache:
                    import_cache[path] = import_module(path)

    included_routers = set()

    for module in import_cache.values():
        router_id = id(module.router)

        if router_id in included_routers: continue

        included_routers.add(router_id)
        subapp.include_router(module.router)

    del import_cache

load(app)
