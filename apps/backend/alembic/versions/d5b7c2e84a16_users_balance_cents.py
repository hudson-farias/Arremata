"""users balance in cents

Revision ID: d5b7c2e84a16
Revises: f3c8a91e6b24
Create Date: 2026-10-31 14:35:00

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import BigInteger, Column


revision: str = 'd5b7c2e84a16'
down_revision: Union[str, None] = 'f3c8a91e6b24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        Column('balance_cents', BigInteger(), nullable = False, server_default = '0'),
    )


def downgrade() -> None:
    op.drop_column('users', 'balance_cents')
