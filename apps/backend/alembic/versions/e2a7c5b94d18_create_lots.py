"""create lots

Revision ID: e2a7c5b94d18
Revises: c4e8a1b72d09
Create Date: 2026-10-29 21:10:00

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, JSON, Numeric, String


revision: str = "e2a7c5b94d18"
down_revision: Union[str, None] = "c4e8a1b72d09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lots",
        Column("id", Integer(), primary_key = True, autoincrement = True, nullable = False),
        Column("owner_id", Integer(), ForeignKey("users.id"), nullable = False, index = True),
        Column("card_id", String(length = 64), nullable = False),
        Column("title", String(length = 255), nullable = False),
        Column("image_url", String(length = 2048), nullable = False),
        Column("attributes", JSON(), nullable = False),
        Column("starts_at", DateTime(timezone = True), nullable = False),
        Column("ends_at", DateTime(timezone = True), nullable = False),
        Column("minimum_bid", Numeric(precision = 12, scale = 2), nullable = False),
        Column("cancelled_at", DateTime(timezone = True), nullable = True),
        CheckConstraint("ends_at > starts_at", name = "lots_ends_after_starts"),
        CheckConstraint("minimum_bid > 0", name = "lots_minimum_bid_positive"),
    )


def downgrade() -> None:
    op.drop_table("lots")
