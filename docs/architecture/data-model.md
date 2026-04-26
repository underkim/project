# Data Model

Planner 모듈의 4계층 데이터 모델. 이후 다른 모듈은 이 구조를 기반으로 확장한다.

## 개요

```
Roadmap (1) ─── (N) Phase ─── (N) Category ─── (N) Item
```

- **Roadmap**: 전체 계획 (V1은 1개 가정)
- **Phase**: 큰 단계 (4개 — 기반 / 가속 / 확장 / 안정)
- **Category**: 영역 (Phase당 4개 — 커리어 / 재테크 / 건강 / 자기계발)
- **Item**: 체크리스트 항목

## ER 다이어그램

```
┌─────────────┐
│   Roadmap   │
├─────────────┤
│ id (PK)     │
│ title       │
│ start_date  │
│ total_months│
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────┐
│    Phase    │
├─────────────┤
│ id (PK)     │
│ roadmap_id  │ (FK)
│ order       │
│ label       │
│ months      │
│ color       │
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────┐
│  Category   │
├─────────────┤
│ id (PK)     │
│ phase_id    │ (FK)
│ icon        │
│ title       │
│ subtitle    │
└──────┬──────┘
       │ 1:N
       ▼
┌──────────────┐
│     Item     │
├──────────────┤
│ id (PK)      │
│ category_id  │ (FK)
│ text         │
│ offset_months│
│ is_done      │
│ completed_at │
└──────────────┘
```

## 엔티티 정의

### Roadmap

| 필드 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| title | str | "종합 라이프 로드맵" |
| start_date | date | 로드맵 시작일 |
| total_months | int | 전체 기간 (60 = 5년) |

### Phase

| 필드 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| roadmap_id | int | FK → Roadmap |
| order | int | 순서 (1~4) |
| label | str | "기반 다지기" |
| months | int | 단계 기간 |
| color | str | UI 색상 (#4f46e5) |

### Category

| 필드 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| phase_id | int | FK → Phase |
| icon | str | 이모지 (💻) |
| title | str | "커리어" |
| subtitle | str | "Python 백엔드 + 알고리즘" |

### Item

| 필드 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| category_id | int | FK → Category |
| text | str | 항목 내용 |
| offset_months | float | Phase 시작 기준 오프셋 |
| is_done | bool | 완료 여부 |
| completed_at | datetime \| null | 완료 시각 |

## 파생값 (저장 X)

| 값 | 계산식 |
|----|--------|
| Phase.start_date | Roadmap.start_date + Σ(이전 Phase들의 months) |
| Phase.end_date | Phase.start_date + months |
| Item.deadline | Phase.start_date + offset_months |
| Item.status | 완료 / 임박(≤30일) / 정상 / 지연 |

## 흐름: "오늘 할 일" 도출

```
1. 모든 Item 조회 (is_done = false)
2. 각 Item의 deadline 계산
3. deadline ≤ 오늘 + 7일 인 항목만 필터
4. deadline 오름차순 정렬
```

## 관련 ADR

- ADR-0003 SQLAlchemy Async (작성 예정)