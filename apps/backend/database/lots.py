from datetime import datetime

from sqlalchemy import JSON, BigInteger, Column, DateTime, ForeignKey, Integer, String, and_, select

from database import Base, Session


class LotsORM(Base):
    __tablename__ = 'lots'

    id = Column(Integer, primary_key = True, index = True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable = False, index = True)
    card_id = Column(String(64), nullable = False)
    title = Column(String(255), nullable = False)
    image_url = Column(String(2048), nullable = False)
    attributes = Column(JSON, nullable = False)
    starts_at = Column(DateTime(timezone = True), nullable = False, index = True)
    ends_at = Column(DateTime(timezone = True), nullable = False, index = True)
    minimum_bid = Column(BigInteger, nullable = False)
    increment_cents = Column(BigInteger, nullable = False, default = 10000, server_default = '10000')
    cancelled_at = Column(DateTime(timezone = True), nullable = True, index = True)

    @classmethod
    def _status_clause(cls, status: str, moment: datetime):
        active = cls.cancelled_at.is_(None)

        if status == 'live':
            return and_(active, cls.starts_at <= moment, cls.ends_at > moment)

        if status == 'scheduled':
            return and_(active, cls.starts_at > moment)

        if status == 'closed':
            return and_(active, cls.ends_at <= moment)

        raise ValueError('status inválido')

    async def find_by_status(self, status: str, moment: datetime):
        stmt = (
            select(self.__class__)
            .where(self.__class__._status_clause(status, moment))
            .order_by(self.__class__.id)
        )

        async with Session() as db:
            result = await db.execute(stmt)
            return result.scalars().all()
