from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer

from database import Base


class BidsORM(Base):
    __tablename__ = 'bids'

    id = Column(Integer, primary_key = True, index = True)
    lot_id = Column(Integer, ForeignKey('lots.id'), nullable = False, index = True)
    bidder_id = Column(Integer, ForeignKey('users.id'), nullable = False, index = True)
    amount_cents = Column(BigInteger, nullable = False)
    created_at = Column(DateTime(timezone = True), nullable = False)
