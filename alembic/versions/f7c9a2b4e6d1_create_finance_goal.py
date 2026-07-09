"""create_finance_goal

Revision ID: f7c9a2b4e6d1
Revises: a632e06d74ce
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f7c9a2b4e6d1'
down_revision: Union[str, Sequence[str], None] = 'a632e06d74ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'finance_goal',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('target_amount', sa.Integer(), nullable=True),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('expected_annual_return_rate', sa.Float(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )
    if op.get_bind().dialect.name == 'postgresql':
        op.execute('ALTER TABLE public.finance_goal ENABLE ROW LEVEL SECURITY;')


def downgrade() -> None:
    op.drop_table('finance_goal')
