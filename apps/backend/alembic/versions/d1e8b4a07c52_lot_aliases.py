"""apelido por lote

Revision ID: d1e8b4a07c52
Revises: a3f6c8d21e74
Create Date: 2026-11-14 17:20:00

Cria lot_aliases e bids.nickname.
Preenche um apelido estável por par lote e licitante.
Não reassina o livro já gravado.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String, UniqueConstraint, text

from services.alias import stable_nickname


revision: str = 'd1e8b4a07c52'
down_revision: Union[str, None] = 'a3f6c8d21e74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lot_aliases',
        Column('id', Integer(), primary_key = True, autoincrement = True, nullable = False),
        Column('lot_id', Integer(), ForeignKey('lots.id'), nullable = False, index = True),
        Column('user_id', Integer(), ForeignKey('users.id'), nullable = False, index = True),
        Column('nickname', String(length = 64), nullable = False),
        UniqueConstraint('lot_id', 'user_id', name = 'lot_aliases_lot_user_unique'),
        UniqueConstraint('lot_id', 'nickname', name = 'lot_aliases_lot_nickname_unique'),
        CheckConstraint(
            "nickname ~ '^[a-z]+-[a-z]+$'",
            name = 'lot_aliases_nickname_form',
        ),
    )
    op.add_column('bids', Column('nickname', String(length = 64), nullable = True))
    _backfill(op.get_bind())
    op.alter_column('bids', 'nickname', existing_type = String(length = 64), nullable = False)
    op.create_check_constraint(
        'bids_nickname_form',
        'bids',
        "nickname ~ '^[a-z]+-[a-z]+$'",
    )


def downgrade() -> None:
    op.drop_constraint('bids_nickname_form', 'bids', type_ = 'check')
    op.drop_column('bids', 'nickname')
    op.drop_table('lot_aliases')


def _backfill(bind) -> None:
    pairs = bind.execute(text(
        '''
        SELECT DISTINCT lot_id, bidder_id
        FROM bids
        ORDER BY lot_id ASC, bidder_id ASC
        '''
    )).mappings().all()
    taken: dict[int, set[str]] = {}

    for row in pairs:
        lot_id = int(row['lot_id'])
        user_id = int(row['bidder_id'])
        used = taken.setdefault(lot_id, set())
        nickname = stable_nickname(lot_id, user_id, used)
        used.add(nickname)
        bind.execute(
            text(
                'INSERT INTO lot_aliases (lot_id, user_id, nickname) '
                'VALUES (:lot_id, :user_id, :nickname)'
            ),
            {'lot_id': lot_id, 'user_id': user_id, 'nickname': nickname},
        )
        bind.execute(
            text(
                'UPDATE bids SET nickname = :nickname '
                'WHERE lot_id = :lot_id AND bidder_id = :user_id'
            ),
            {'lot_id': lot_id, 'user_id': user_id, 'nickname': nickname},
        )
