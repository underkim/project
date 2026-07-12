"""create configurable trackers

Revision ID: e8f1a2b3c4d5
Revises: f7c9a2b4e6d1
"""
from alembic import op
import sqlalchemy as sa

revision = "e8f1a2b3c4d5"
down_revision = "f7c9a2b4e6d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trackers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("description", sa.String(length=240), nullable=True),
        sa.Column("value_type", sa.String(length=16), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=True),
        sa.Column("color", sa.String(length=7), nullable=False, server_default="#6366f1"),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "tracker_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tracker_id", sa.Integer(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("value", sa.String(length=500), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tracker_id"], ["trackers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tracker_entries_tracker_id", "tracker_entries", ["tracker_id"])
    op.create_index("ix_tracker_entries_entry_date", "tracker_entries", ["entry_date"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    op.drop_index("ix_tracker_entries_entry_date", table_name="tracker_entries")
    op.drop_index("ix_tracker_entries_tracker_id", table_name="tracker_entries")
    op.drop_table("tracker_entries")
    op.drop_table("trackers")
