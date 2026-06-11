# ADR-0005: Roadmap 데이터 모델 설계

## Status
Accepted

## Context
종합 라이프 로드맵(5년, Phase1~4)을 프론트엔드 하드코딩 구조에서 DB 기반으로 마이그레이션 필요. 현재 구조는 Phase > Category(4개 고정) > Item 계층이며, 완료 체크 상태는 프론트 state로만 관리되어 영속성 없음.

## Decision
- 단일 사용자 기준으로 설계 (user_id 컬럼 없음)
- 3단 정규화: `phases` / `categories` / `roadmap_items`
- 전체 시작일은 별도 `roadmap_settings`(단일 row) 테이블로 분리, deadline은 `offset_months` 기반 동적 계산
- `is_completed`만 API로 토글 가능한 상태값으로 관리

## Table Schema

### phases
- id (PK)
- key (예: "p1", "p2"...)
- name (예: "Phase 1")
- label (예: "기반 다지기")
- order
- months
- color
- bg

### categories
- id (PK)
- phase_id (FK -> phases.id)
- icon
- title
- subtitle
- order

### roadmap_items
- id (PK)
- category_id (FK -> categories.id)
- text
- offset_months (float, Phase 시작 기준 오프셋)
- is_completed (boolean, default False)
- order

### roadmap_settings
- id (PK, 항상 1)
- start_date

## Consequences
- phases/categories는 초기 seed 데이터로 1회 적재, 이후 거의 변경 없음
- roadmap_items의 offset_months는 정적이고, 실제 deadline은 roadmap_settings.start_date + phase 누적 + offset으로 계산
- 향후 멀티유저 전환 시 모든 테이블에 user_id 추가 필요 (현재는 범위 외)