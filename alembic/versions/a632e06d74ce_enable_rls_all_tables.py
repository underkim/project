"""enable_rls_all_tables

Revision ID: a632e06d74ce
Revises: d5e8f1a2b3c4
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a632e06d74ce'
down_revision: Union[str, Sequence[str], None] = 'd5e8f1a2b3c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Supabase Security Advisor(rls_disabled_in_public)가 지적한 public 스키마 테이블 전체.
# 앱은 PostgREST/anon key를 쓰지 않고 postgres(테이블 소유자) 계정으로 직접 접속하므로,
# 정책 없이 RLS만 켜면 PostgREST 경유 접근(anon/authenticated)만 차단되고
# 백엔드의 기존 접속(테이블 소유자는 RLS 미적용)은 영향받지 않는다.
TABLES = [
    'alembic_version',
    'roadmap_settings',
    'phases',
    'categories',
    'roadmap_items',
    'asset_records',
    'exercise_logs',
    'sleep_logs',
    'book_records',
    'english_logs',
    'career_settings',
    'cf_rating_logs',
    'trips',
    'trip_checklist_items',
    'trip_plan_items',
    'trip_restaurants',
]


def upgrade() -> None:
    if op.get_bind().dialect.name != 'postgresql':
        return
    for table in TABLES:
        op.execute(f'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;')


def downgrade() -> None:
    if op.get_bind().dialect.name != 'postgresql':
        return
    for table in TABLES:
        op.execute(f'ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY;')
