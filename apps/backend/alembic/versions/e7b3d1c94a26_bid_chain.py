"""cadeia hmac dos lances

Revision ID: e7b3d1c94a26
Revises: b4c7e2a91d05
Create Date: 2026-11-01 13:50:00

O backfill assina lances e liquidações já gravados.
Esta migration precisa de AUDIT_SECRET no ambiente quando houver lances
ou liquidações. Sem essas linhas, só cria as colunas.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import Column, Integer, String, text

from env import AUDIT_SECRET
from services.chain import bid_message, genesis_message, sign


revision: str = 'e7b3d1c94a26'
down_revision: Union[str, None] = 'b4c7e2a91d05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(text("SET TIME ZONE 'UTC'"))
    bid_count = int(bind.execute(text('SELECT COUNT(*) FROM bids')).scalar() or 0)
    settlement_count = int(bind.execute(text('SELECT COUNT(*) FROM settlements')).scalar() or 0)

    if (bid_count or settlement_count) and not AUDIT_SECRET:
        raise RuntimeError(
            'Variáveis de ambiente ausentes: AUDIT_SECRET. '
            'A migration precisa dessa variável para assinar lances ou liquidações já gravados.'
        )

    op.add_column('bids', Column('position', Integer(), nullable = True))
    op.add_column('bids', Column('prev_hash', String(length = 64), nullable = True))
    op.add_column('bids', Column('hash', String(length = 64), nullable = True))
    op.add_column('settlements', Column('chain_head', String(length = 64), nullable = True))

    if bid_count or settlement_count:
        _backfill(bind)

    op.alter_column('bids', 'position', existing_type = Integer(), nullable = False)
    op.alter_column('bids', 'prev_hash', existing_type = String(length = 64), nullable = False)
    op.alter_column('bids', 'hash', existing_type = String(length = 64), nullable = False)
    op.alter_column('settlements', 'chain_head', existing_type = String(length = 64), nullable = False)
    op.create_unique_constraint('bids_lot_position_unique', 'bids', ['lot_id', 'position'])
    op.create_check_constraint('bids_position_positive', 'bids', 'position > 0')


def downgrade() -> None:
    op.drop_constraint('bids_position_positive', 'bids', type_ = 'check')
    op.drop_constraint('bids_lot_position_unique', 'bids', type_ = 'unique')
    op.drop_column('bids', 'hash')
    op.drop_column('bids', 'prev_hash')
    op.drop_column('bids', 'position')
    op.drop_column('settlements', 'chain_head')


def _backfill(bind) -> None:
    lots = {
        int(row['id']): row
        for row in bind.execute(text(
            'SELECT id, minimum_bid, increment_cents, starts_at FROM lots'
        )).mappings()
    }
    bid_rows = bind.execute(text(
        '''
        SELECT id, lot_id, bidder_id, amount_cents, created_at
        FROM bids
        ORDER BY lot_id ASC, created_at ASC, id ASC
        '''
    )).mappings().all()
    heads: dict[int, str] = {}
    current_lot = None
    previous = None
    position = 0

    for row in bid_rows:
        lot_id = int(row['lot_id'])
        lot = lots.get(lot_id)

        if lot is None:
            raise RuntimeError(f'lote ausente ao assinar lances: {lot_id}')

        if lot_id != current_lot:
            if current_lot is not None:
                heads[current_lot] = previous

            current_lot = lot_id
            position = 1
            previous = sign(genesis_message(
                lot_id,
                int(lot['minimum_bid']),
                int(lot['increment_cents']),
                lot['starts_at'],
            ))
        else:
            position += 1

        digest = sign(bid_message(
            lot_id,
            position,
            int(row['bidder_id']),
            int(row['amount_cents']),
            row['created_at'],
            previous,
        ))
        bind.execute(
            text(
                'UPDATE bids SET position = :position, prev_hash = :prev_hash, "hash" = :digest '
                'WHERE id = :id'
            ),
            {
                'position': position,
                'prev_hash': previous,
                'digest': digest,
                'id': int(row['id']),
            },
        )
        previous = digest

    if current_lot is not None:
        heads[current_lot] = previous

    settlement_rows = bind.execute(text(
        'SELECT id, lot_id FROM settlements ORDER BY id ASC'
    )).mappings().all()

    for row in settlement_rows:
        lot_id = int(row['lot_id'])

        if lot_id in heads:
            head = heads[lot_id]
        else:
            lot = lots.get(lot_id)

            if lot is None:
                raise RuntimeError(f'lote ausente ao assinar liquidação: {lot_id}')

            head = sign(genesis_message(
                lot_id,
                int(lot['minimum_bid']),
                int(lot['increment_cents']),
                lot['starts_at'],
            ))

        bind.execute(
            text('UPDATE settlements SET chain_head = :chain_head WHERE id = :id'),
            {'chain_head': head, 'id': int(row['id'])},
        )
