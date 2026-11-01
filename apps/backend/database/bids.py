from sqlalchemy import BigInteger, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from database import Base


class BidsORM(Base):
    __tablename__ = 'bids'
    __table_args__ = (
        UniqueConstraint('lot_id', 'position', name = 'bids_lot_position_unique'),
        UniqueConstraint('lot_id', 'amount_cents', name = 'bids_lot_amount_unique'),
        CheckConstraint('position > 0', name = 'bids_position_positive'),
    )

    id = Column(Integer, primary_key = True, index = True)
    lot_id = Column(Integer, ForeignKey('lots.id'), nullable = False, index = True)
    bidder_id = Column(Integer, ForeignKey('users.id'), nullable = False, index = True)
    amount_cents = Column(BigInteger, nullable = False)
    created_at = Column(DateTime(timezone = True), nullable = False)
    position = Column(Integer, nullable = False)
    prev_hash = Column(String(64), nullable = False)
    hash = Column(String(64), nullable = False)
