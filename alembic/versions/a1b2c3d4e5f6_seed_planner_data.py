"""seed planner data

Revision ID: a1b2c3d4e5f6
Revises: 4bbb978ce5a7
Create Date: 2026-06-20 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '4bbb978ce5a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    phases_table = sa.table('phases',
        sa.column('id', sa.Integer),
        sa.column('name', sa.String),
        sa.column('label', sa.String),
        sa.column('order_index', sa.Integer),
        sa.column('months', sa.Integer),
        sa.column('color', sa.String),
    )
    op.bulk_insert(phases_table, [
        {'id': 1, 'name': 'Phase 1', 'label': '기반 다지기', 'order_index': 1, 'months': 12, 'color': '#6366f1'},
        {'id': 2, 'name': 'Phase 2', 'label': '성장 가속',  'order_index': 2, 'months': 12, 'color': '#8b5cf6'},
        {'id': 3, 'name': 'Phase 3', 'label': '전문성 확보', 'order_index': 3, 'months': 18, 'color': '#a855f7'},
        {'id': 4, 'name': 'Phase 4', 'label': '목표 달성',  'order_index': 4, 'months': 18, 'color': '#d946ef'},
    ])

    categories_table = sa.table('categories',
        sa.column('id', sa.Integer),
        sa.column('phase_id', sa.Integer),
        sa.column('icon', sa.String),
        sa.column('title', sa.String),
        sa.column('subtitle', sa.String),
        sa.column('order_index', sa.Integer),
    )
    op.bulk_insert(categories_table, [
        # Phase 1
        {'id': 1,  'phase_id': 1, 'icon': '💼', 'title': '커리어',   'subtitle': 'CS 기초 & 알고리즘',    'order_index': 1},
        {'id': 2,  'phase_id': 1, 'icon': '💰', 'title': '재테크',   'subtitle': '비상금 & 소비 습관',     'order_index': 2},
        {'id': 3,  'phase_id': 1, 'icon': '🏃', 'title': '건강',     'subtitle': '운동 & 수면 루틴',       'order_index': 3},
        {'id': 4,  'phase_id': 1, 'icon': '📚', 'title': '자기계발', 'subtitle': '독서 & 영어',            'order_index': 4},
        # Phase 2
        {'id': 5,  'phase_id': 2, 'icon': '💼', 'title': '커리어',   'subtitle': '포트폴리오 & 오픈소스',  'order_index': 1},
        {'id': 6,  'phase_id': 2, 'icon': '💰', 'title': '재테크',   'subtitle': '투자 & 자산 형성',       'order_index': 2},
        {'id': 7,  'phase_id': 2, 'icon': '🏃', 'title': '건강',     'subtitle': '체력 & 식단',            'order_index': 3},
        {'id': 8,  'phase_id': 2, 'icon': '📚', 'title': '자기계발', 'subtitle': '심화 학습',              'order_index': 4},
        # Phase 3
        {'id': 9,  'phase_id': 3, 'icon': '💼', 'title': '커리어',   'subtitle': '취업 & 이직',            'order_index': 1},
        {'id': 10, 'phase_id': 3, 'icon': '💰', 'title': '재테크',   'subtitle': '자산 증식',              'order_index': 2},
        {'id': 11, 'phase_id': 3, 'icon': '🏃', 'title': '건강',     'subtitle': '장기 건강 관리',         'order_index': 3},
        {'id': 12, 'phase_id': 3, 'icon': '📚', 'title': '자기계발', 'subtitle': '전문 지식 & 네트워크',   'order_index': 4},
        # Phase 4
        {'id': 13, 'phase_id': 4, 'icon': '💼', 'title': '커리어',   'subtitle': '시니어 & 리더십',        'order_index': 1},
        {'id': 14, 'phase_id': 4, 'icon': '💰', 'title': '재테크',   'subtitle': '재무 자유',              'order_index': 2},
        {'id': 15, 'phase_id': 4, 'icon': '🏃', 'title': '건강',     'subtitle': '생활 습관 완성',         'order_index': 3},
        {'id': 16, 'phase_id': 4, 'icon': '📚', 'title': '자기계발', 'subtitle': '지식 공유 & 멘토링',     'order_index': 4},
    ])

    items_table = sa.table('roadmap_items',
        sa.column('id', sa.Integer),
        sa.column('category_id', sa.Integer),
        sa.column('text', sa.String),
        sa.column('offset', sa.Float),
        sa.column('is_completed', sa.Boolean),
    )
    op.bulk_insert(items_table, [
        # Phase 1 - 커리어 (cat 1)
        {'id': 1,  'category_id': 1,  'text': '자료구조·알고리즘 핵심 개념 정리 완료',       'offset': 3.0,  'is_completed': False},
        {'id': 2,  'category_id': 1,  'text': '백준 실버 1 달성',                           'offset': 6.0,  'is_completed': False},
        {'id': 3,  'category_id': 1,  'text': '포트폴리오 프로젝트 1개 완성 (이 프로젝트!)', 'offset': 9.0,  'is_completed': False},
        {'id': 4,  'category_id': 1,  'text': '이력서 초안 작성',                           'offset': 12.0, 'is_completed': False},
        # Phase 1 - 재테크 (cat 2)
        {'id': 5,  'category_id': 2,  'text': '월 가계부 작성 시작',                        'offset': 1.0,  'is_completed': False},
        {'id': 6,  'category_id': 2,  'text': '비상금 1개월치 마련',                        'offset': 6.0,  'is_completed': False},
        {'id': 7,  'category_id': 2,  'text': '비상금 3개월치 달성',                        'offset': 12.0, 'is_completed': False},
        {'id': 8,  'category_id': 2,  'text': '첫 ETF 투자 시작',                           'offset': 12.0, 'is_completed': False},
        # Phase 1 - 건강 (cat 3)
        {'id': 9,  'category_id': 3,  'text': '주 3회 30분 운동 습관화 (3개월 유지)',       'offset': 3.0,  'is_completed': False},
        {'id': 10, 'category_id': 3,  'text': '수면 23시 전 취침 루틴 정착',               'offset': 6.0,  'is_completed': False},
        {'id': 11, 'category_id': 3,  'text': '체지방률 25% 이하 달성',                    'offset': 12.0, 'is_completed': False},
        # Phase 1 - 자기계발 (cat 4)
        {'id': 12, 'category_id': 4,  'text': '영어 하루 30분 루틴 시작',                  'offset': 1.0,  'is_completed': False},
        {'id': 13, 'category_id': 4,  'text': '독서 6권 완독 (상반기)',                    'offset': 6.0,  'is_completed': False},
        {'id': 14, 'category_id': 4,  'text': '독서 12권 완독',                            'offset': 12.0, 'is_completed': False},
        {'id': 15, 'category_id': 4,  'text': 'TOEIC 850+ 또는 OPIc IM',                  'offset': 12.0, 'is_completed': False},
        # Phase 2 - 커리어 (cat 5)
        {'id': 16, 'category_id': 5,  'text': '기술 블로그 포스트 6개 작성',               'offset': 6.0,  'is_completed': False},
        {'id': 17, 'category_id': 5,  'text': '오픈소스 기여 PR 3개 이상',                 'offset': 9.0,  'is_completed': False},
        {'id': 18, 'category_id': 5,  'text': '백준 골드 달성',                            'offset': 12.0, 'is_completed': False},
        {'id': 19, 'category_id': 5,  'text': '사이드 프로젝트 팀 합류 또는 첫 인턴십',   'offset': 12.0, 'is_completed': False},
        # Phase 2 - 재테크 (cat 6)
        {'id': 20, 'category_id': 6,  'text': '월 저축률 20% 달성',                        'offset': 3.0,  'is_completed': False},
        {'id': 21, 'category_id': 6,  'text': 'ISA 계좌 개설 및 월 납입',                  'offset': 3.0,  'is_completed': False},
        {'id': 22, 'category_id': 6,  'text': '투자 포트폴리오 3종 분산',                  'offset': 12.0, 'is_completed': False},
        {'id': 23, 'category_id': 6,  'text': '총 자산 1,000만원 달성',                    'offset': 12.0, 'is_completed': False},
        # Phase 2 - 건강 (cat 7)
        {'id': 24, 'category_id': 7,  'text': '주 5회 운동 달성',                          'offset': 6.0,  'is_completed': False},
        {'id': 25, 'category_id': 7,  'text': '상반기 건강검진',                           'offset': 6.0,  'is_completed': False},
        {'id': 26, 'category_id': 7,  'text': '단백질 목표 달성 90일 연속',                'offset': 12.0, 'is_completed': False},
        # Phase 2 - 자기계발 (cat 8)
        {'id': 27, 'category_id': 8,  'text': '영어 원서 1권 완독',                        'offset': 6.0,  'is_completed': False},
        {'id': 28, 'category_id': 8,  'text': '온라인 강의 수료 1개 (CS or 실무)',         'offset': 9.0,  'is_completed': False},
        {'id': 29, 'category_id': 8,  'text': '독서 누적 24권 달성',                       'offset': 12.0, 'is_completed': False},
        # Phase 3 - 커리어 (cat 9)
        {'id': 30, 'category_id': 9,  'text': '주니어 개발자 취업 또는 이직',              'offset': 6.0,  'is_completed': False},
        {'id': 31, 'category_id': 9,  'text': 'Codeforces 1200+ (Specialist)',             'offset': 12.0, 'is_completed': False},
        {'id': 32, 'category_id': 9,  'text': '사내 프로젝트 주도적 기여',                 'offset': 18.0, 'is_completed': False},
        # Phase 3 - 재테크 (cat 10)
        {'id': 33, 'category_id': 10, 'text': '월 저축률 30% 달성',                        'offset': 6.0,  'is_completed': False},
        {'id': 34, 'category_id': 10, 'text': '총 자산 3,000만원 달성',                    'offset': 18.0, 'is_completed': False},
        # Phase 3 - 건강 (cat 11)
        {'id': 35, 'category_id': 11, 'text': '마라톤 5km 완주',                           'offset': 9.0,  'is_completed': False},
        {'id': 36, 'category_id': 11, 'text': '매년 건강검진 루틴 정착',                   'offset': 18.0, 'is_completed': False},
        # Phase 3 - 자기계발 (cat 12)
        {'id': 37, 'category_id': 12, 'text': 'TOEIC 900+ 또는 OPIc AL',                  'offset': 9.0,  'is_completed': False},
        {'id': 38, 'category_id': 12, 'text': '기술 컨퍼런스 발표 1회',                   'offset': 18.0, 'is_completed': False},
        # Phase 4 - 커리어 (cat 13)
        {'id': 39, 'category_id': 13, 'text': '미드레벨 개발자 역할 수행',                 'offset': 6.0,  'is_completed': False},
        {'id': 40, 'category_id': 13, 'text': '팀 리딩 또는 코드 리뷰 문화 주도',         'offset': 18.0, 'is_completed': False},
        # Phase 4 - 재테크 (cat 14)
        {'id': 41, 'category_id': 14, 'text': '총 자산 1억 달성',                          'offset': 18.0, 'is_completed': False},
        {'id': 42, 'category_id': 14, 'text': '월 배당 수입 시작',                         'offset': 12.0, 'is_completed': False},
        # Phase 4 - 건강 (cat 15)
        {'id': 43, 'category_id': 15, 'text': '규칙적 운동 5년 유지',                      'offset': 18.0, 'is_completed': False},
        # Phase 4 - 자기계발 (cat 16)
        {'id': 44, 'category_id': 16, 'text': '독서 누적 60권 달성',                       'offset': 18.0, 'is_completed': False},
        {'id': 45, 'category_id': 16, 'text': '주니어 멘토링 활동',                        'offset': 12.0, 'is_completed': False},
    ])


def downgrade() -> None:
    op.execute("DELETE FROM roadmap_items")
    op.execute("DELETE FROM categories")
    op.execute("DELETE FROM phases")
