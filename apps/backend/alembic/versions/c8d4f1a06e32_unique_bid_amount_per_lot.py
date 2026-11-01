"""valor de lance único por lote

Revision ID: c8d4f1a06e32
Revises: e7b3d1c94a26
Create Date: 2026-11-01 14:46:00

Dois lances do mesmo lote não podem ter o mesmo amount_cents.
Se já houver duplicata, a migration para e não apaga dado.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = 'c8d4f1a06e32'
down_revision: Union[str, None] = 'e7b3d1c94a26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    duplicates = bind.execute(text(
        '''
        SELECT lot_id, amount_cents, COUNT(*) AS copies
        FROM bids
        GROUP BY lot_id, amount_cents
        HAVING COUNT(*) > 1
        ORDER BY lot_id ASC, amount_cents ASC
        '''
    )).mappings().all()

    if duplicates:
        detail = '; '.join(
            f'lote {int(row["lot_id"])} valor {int(row["amount_cents"])} ({int(row["copies"])} linhas)'
            for row in duplicates
        )
        raise RuntimeError(
            'Há valores de lance repetidos no mesmo lote. Nenhum dado foi apagado. '
            f'Duplicatas: {detail}'
        )

    op.create_unique_constraint(
        'bids_lot_amount_unique',
        'bids',
        ['lot_id', 'amount_cents'],
    )


def downgrade() -> None:
    op.drop_constraint('bids_lot_amount_unique', 'bids', type_ = 'unique')
