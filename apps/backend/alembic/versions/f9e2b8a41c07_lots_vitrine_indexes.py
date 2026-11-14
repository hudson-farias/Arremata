"""índices da vitrine em datas e cancelled_at

Revision ID: f9e2b8a41c07
Revises: d1e8b4a07c52
Create Date: 2026-11-14 18:55:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'f9e2b8a41c07'
down_revision: Union[str, None] = 'd1e8b4a07c52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_lots_starts_at', 'lots', ['starts_at'])
    op.create_index('ix_lots_ends_at', 'lots', ['ends_at'])
    op.create_index('ix_lots_cancelled_at', 'lots', ['cancelled_at'])


def downgrade() -> None:
    op.drop_index('ix_lots_cancelled_at', table_name = 'lots')
    op.drop_index('ix_lots_ends_at', table_name = 'lots')
    op.drop_index('ix_lots_starts_at', table_name = 'lots')
