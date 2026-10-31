"""lots increment and bids

Revision ID: a8f3d6c21e09
Revises: d5b7c2e84a16
Create Date: 2026-10-31 14:50:00

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import BigInteger, CheckConstraint, Column, DateTime, ForeignKey, Integer


revision: str = 'a8f3d6c21e09'
down_revision: Union[str, None] = 'd5b7c2e84a16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'lots',
        Column('increment_cents', BigInteger(), nullable = False, server_default = '10000'),
    )
    op.create_check_constraint(
        'lots_increment_positive',
        'lots',
        'increment_cents > 0',
    )
    op.create_table(
        'bids',
        Column('id', Integer(), primary_key = True, autoincrement = True, nullable = False),
        Column('lot_id', Integer(), ForeignKey('lots.id'), nullable = False, index = True),
        Column('bidder_id', Integer(), ForeignKey('users.id'), nullable = False, index = True),
        Column('amount_cents', BigInteger(), nullable = False),
        Column('created_at', DateTime(timezone = True), nullable = False),
        CheckConstraint('amount_cents > 0', name = 'bids_amount_positive'),
    )


def downgrade() -> None:
    op.drop_table('bids')
    op.drop_constraint('lots_increment_positive', 'lots', type_ = 'check')
    op.drop_column('lots', 'increment_cents')
