from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String, UniqueConstraint

from database import Base


class LotAliasesORM(Base):
    __tablename__ = 'lot_aliases'
    __table_args__ = (
        UniqueConstraint('lot_id', 'user_id', name = 'lot_aliases_lot_user_unique'),
        UniqueConstraint('lot_id', 'nickname', name = 'lot_aliases_lot_nickname_unique'),
        CheckConstraint(
            "nickname ~ '^[a-z]+-[a-z]+$'",
            name = 'lot_aliases_nickname_form',
        ),
    )

    id = Column(Integer, primary_key = True, index = True)
    lot_id = Column(Integer, ForeignKey('lots.id'), nullable = False, index = True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable = False, index = True)
    nickname = Column(String(64), nullable = False)
