from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, Numeric, String

from database import Base


class LotsORM(Base):
    __tablename__ = 'lots'

    id = Column(Integer, primary_key = True, index = True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable = False, index = True)
    card_id = Column(String(64), nullable = False)
    title = Column(String(255), nullable = False)
    image_url = Column(String(2048), nullable = False)
    attributes = Column(JSON, nullable = False)
    starts_at = Column(DateTime(timezone = True), nullable = False)
    ends_at = Column(DateTime(timezone = True), nullable = False)
    minimum_bid = Column(Numeric(12, 2), nullable = False)
    cancelled_at = Column(DateTime(timezone = True), nullable = True)
