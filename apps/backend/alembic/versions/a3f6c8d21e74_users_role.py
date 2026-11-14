"""users role

Revision ID: a3f6c8d21e74
Revises: c8d4f1a06e32
Create Date: 2026-11-14 15:00:00

Acrescenta a coluna role, anulável e sem valor padrão.
Linhas já existentes ficam com role nulo.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import Column, String


revision: str = 'a3f6c8d21e74'
down_revision: Union[str, None] = 'c8d4f1a06e32'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', Column('role', String(length = 32), nullable = True))
    op.create_check_constraint(
        'users_role_known',
        'users',
        "role IS NULL OR role IN ('auctioneer', 'bidder')",
    )


def downgrade() -> None:
    op.drop_constraint('users_role_known', 'users', type_ = 'check')
    op.drop_column('users', 'role')
