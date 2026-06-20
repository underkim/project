"""create travel tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-20 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'trips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('destination', sa.String(100), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='planned'),
        sa.Column('note', sa.String(500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'trip_checklist_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('trip_id', sa.Integer(), nullable=False),
        sa.Column('text', sa.String(200), nullable=False),
        sa.Column('is_checked', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('trip_checklist_items')
    op.drop_table('trips')
