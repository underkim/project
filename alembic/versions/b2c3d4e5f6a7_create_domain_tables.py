"""create domain tables (finance, health, growth, career)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-20 16:01:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('asset_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('record_date', sa.Date(), nullable=False),
        sa.Column('total_assets', sa.Integer(), nullable=False),
        sa.Column('monthly_income', sa.Integer(), nullable=False),
        sa.Column('monthly_expense', sa.Integer(), nullable=False),
        sa.Column('note', sa.String(length=200), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('record_date'),
    )

    op.create_table('exercise_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('exercise_type', sa.String(length=50), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('note', sa.String(length=200), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('sleep_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('sleep_hours', sa.Float(), nullable=False),
        sa.Column('quality', sa.Integer(), nullable=False),
        sa.Column('note', sa.String(length=200), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('log_date'),
    )

    op.create_table('book_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('author', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='planned'),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('note', sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('english_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('activity_type', sa.String(length=50), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('note', sa.String(length=200), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('career_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cf_handle', sa.String(length=100), nullable=True),
        sa.Column('github_username', sa.String(length=100), nullable=True),
        sa.Column('blog_url', sa.String(length=200), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('cf_rating_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('rank_name', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('cf_rating_logs')
    op.drop_table('career_settings')
    op.drop_table('english_logs')
    op.drop_table('book_records')
    op.drop_table('sleep_logs')
    op.drop_table('exercise_logs')
    op.drop_table('asset_records')
