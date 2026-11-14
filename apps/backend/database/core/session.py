from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from env import postgres_url


db_url = postgres_url()

engine = create_async_engine(db_url, pool_pre_ping = True, echo = False)
Session = sessionmaker(engine, expire_on_commit = False, class_ = AsyncSession, future = True)
