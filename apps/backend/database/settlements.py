from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String

from database import Base


class SettlementsORM(Base):
    __tablename__ = 'settlements'

    id = Column(Integer, primary_key = True, index = True)
    lot_id = Column(Integer, ForeignKey('lots.id'), nullable = False, unique = True, index = True)
    winner_id = Column(Integer, ForeignKey('users.id'), nullable = True)
    seller_id = Column(Integer, ForeignKey('users.id'), nullable = False)
    amount_cents = Column(BigInteger, nullable = False)
    created_at = Column(DateTime(timezone = True), nullable = False)
    chain_head = Column(String(64), nullable = False)
