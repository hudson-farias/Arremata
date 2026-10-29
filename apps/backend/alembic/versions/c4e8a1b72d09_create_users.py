"""create users

Revision ID: c4e8a1b72d09
Revises:
Create Date: 2026-10-28 20:25:00

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import Column, Integer, String


revision: str = "c4e8a1b72d09"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        Column("id", Integer(), primary_key = True, autoincrement = True, nullable = False),
        Column("email", String(), nullable = False, unique = True),
        Column("password", String(), nullable = False),
    )


def downgrade() -> None:
    op.drop_table("users")
