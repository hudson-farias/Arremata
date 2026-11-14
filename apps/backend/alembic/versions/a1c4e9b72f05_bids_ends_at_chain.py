"""ends_at no elo HMAC dos lances

Revision ID: a1c4e9b72f05
Revises: f9e2b8a41c07
Create Date: 2026-11-14 19:50:00

Cria bids.ends_at, preenche a partir de lots.ends_at e reassina
hash / prev_hash e settlements.chain_head com o AUDIT_SECRET atual.
Esta migration precisa de AUDIT_SECRET no ambiente quando houver lances
ou liquidações. Sem essas linhas, só cria a coluna.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import Column, DateTime, text

from env import AUDIT_SECRET
from services.chain import bid_message, genesis_message, sign


revision: str = 'a1c4e9b72f05'
down_revision: Union[str, None] = 'f9e2b8a41c07'
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

    op.add_column('bids', Column('ends_at', DateTime(timezone = True), nullable = True))
    bind.execute(text(
        '''
        UPDATE bids AS bid
        SET ends_at = lot.ends_at
        FROM lots AS lot
        WHERE lot.id = bid.lot_id
        '''
    ))

    if bid_count or settlement_count:
        _resign(bind)

    op.alter_column('bids', 'ends_at', existing_type = DateTime(timezone = True), nullable = False)


def downgrade() -> None:
    op.drop_column('bids', 'ends_at')


def _resign(bind) -> None:
    lots = {
        int(row['id']): row
        for row in bind.execute(text(
            'SELECT id, minimum_bid, increment_cents, starts_at, ends_at FROM lots'
        )).mappings()
    }
    bid_rows = bind.execute(text(
        '''
        SELECT id, lot_id, bidder_id, amount_cents, created_at, ends_at, position, nickname
        FROM bids
        ORDER BY lot_id ASC, position ASC, id ASC
        '''
    )).mappings().all()
    heads: dict[int, str] = {}
    current_lot = None
    previous = None

    for row in bid_rows:
        lot_id = int(row['lot_id'])
        lot = lots.get(lot_id)

        if lot is None:
            raise RuntimeError(f'lote ausente ao assinar lances: {lot_id}')

        if lot_id != current_lot:
            if current_lot is not None:
                heads[current_lot] = previous

            current_lot = lot_id
            previous = sign(genesis_message(
                lot_id,
                int(lot['minimum_bid']),
                int(lot['increment_cents']),
                lot['starts_at'],
            ))

        ends_at = row['ends_at'] if row['ends_at'] is not None else lot['ends_at']
        digest = sign(bid_message(
            lot_id,
            int(row['position']),
            int(row['bidder_id']),
            row['nickname'],
            int(row['amount_cents']),
            row['created_at'],
            previous,
            ends_at,
        ))
        bind.execute(
            text(
                'UPDATE bids SET prev_hash = :prev_hash, "hash" = :digest, ends_at = :ends_at '
                'WHERE id = :id'
            ),
            {
                'prev_hash': previous,
                'digest': digest,
                'ends_at': ends_at,
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
