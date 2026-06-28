"""add_trip_location_and_restaurants

Revision ID: d5e8f1a2b3c4
Revises: 4fbe97fa41c1
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5e8f1a2b3c4'
down_revision: Union[str, Sequence[str], None] = '4fbe97fa41c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trips', sa.Column('address', sa.String(length=200), nullable=True))
    op.add_column('trips', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('longitude', sa.Float(), nullable=True))

    op.create_table(
        'trip_restaurants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('trip_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('address', sa.String(length=200), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('cuisine', sa.String(length=50), nullable=True),
        sa.Column('note', sa.String(length=500), nullable=True),
        sa.Column('is_visited', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('trip_restaurants')
    op.drop_column('trips', 'longitude')
    op.drop_column('trips', 'latitude')
    op.drop_column('trips', 'address')
