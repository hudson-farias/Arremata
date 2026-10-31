"""minimum bid in cents

Revision ID: f3c8a91e6b24
Revises: e2a7c5b94d18
Create Date: 2026-10-31 13:26:00

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import BigInteger, Numeric


revision: str = 'f3c8a91e6b24'
down_revision: Union[str, None] = 'e2a7c5b94d18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('lots_minimum_bid_positive', 'lots', type_ = 'check')
    op.alter_column(
        'lots',
        'minimum_bid',
        existing_type = Numeric(precision = 12, scale = 2),
        type_ = BigInteger(),
        existing_nullable = False,
        postgresql_using = 'ROUND(minimum_bid * 100)::bigint',
    )
    op.create_check_constraint(
        'lots_minimum_bid_positive',
        'lots',
        'minimum_bid > 0',
    )


def downgrade() -> None:
    op.drop_constraint('lots_minimum_bid_positive', 'lots', type_ = 'check')
    op.alter_column(
        'lots',
        'minimum_bid',
        existing_type = BigInteger(),
        type_ = Numeric(precision = 12, scale = 2),
        existing_nullable = False,
        postgresql_using = '(minimum_bid::numeric / 100)',
    )
    op.create_check_constraint(
        'lots_minimum_bid_positive',
        'lots',
        'minimum_bid > 0',
    )
