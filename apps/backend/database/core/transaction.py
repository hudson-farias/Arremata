from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.core.session import Session


class Transaction:
    def __init__(self, db: AsyncSession | None = None):
        self._owned = db is None
        self.db = db
        self._committed = False


    async def __aenter__(self):
        if self.db is None:
            self.db = Session()
            await self.db.__aenter__()

        self.db.expire_on_flush = False
        return self


    async def __aexit__(self, exc_type, exc_value, traceback):
        try:
            if not self._committed:
                await self.db.rollback()
        finally:
            if self._owned and self.db is not None:
                await self.db.__aexit__(exc_type, exc_value, traceback)

        return False


    async def commit(self):
        await self.db.commit()
        self._committed = True


    async def rollback(self):
        await self.db.rollback()
        self._committed = False


    async def execute(self, stmt):
        return await self.db.execute(stmt)


    async def lock(self, model, id, *, skip_locked = False, pk = 'id'):
        stmt = select(model).where(getattr(model, pk) == id).with_for_update(skip_locked = skip_locked)
        result = await self.db.execute(stmt)
        return result.scalars().first()


    async def lock_one(self, stmt, *, skip_locked = False):
        result = await self.db.execute(stmt.with_for_update(skip_locked = skip_locked))
        return result.one_or_none()


    async def lock_row(self, stmt, *, skip_locked = False):
        result = await self.db.execute(stmt.with_for_update(skip_locked = skip_locked))
        return result.scalars().first()
