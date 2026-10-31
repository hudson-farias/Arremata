"""settlements

Revision ID: b4c7e2a91d05
Revises: a8f3d6c21e09
Create Date: 2026-10-31 16:45:00

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import BigInteger, CheckConstraint, Column, DateTime, ForeignKey, Integer


revision: str = 'b4c7e2a91d05'
down_revision: Union[str, None] = 'a8f3d6c21e09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'settlements',
        Column('id', Integer(), primary_key = True, autoincrement = True, nullable = False),
        Column('lot_id', Integer(), ForeignKey('lots.id'), nullable = False, unique = True, index = True),
        Column('winner_id', Integer(), ForeignKey('users.id'), nullable = True),
        Column('seller_id', Integer(), ForeignKey('users.id'), nullable = False),
        Column('amount_cents', BigInteger(), nullable = False),
        Column('created_at', DateTime(timezone = True), nullable = False),
        CheckConstraint('amount_cents >= 0', name = 'settlements_amount_non_negative'),
    )


def downgrade() -> None:
    op.drop_table('settlements')
