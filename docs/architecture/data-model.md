# 데이터 모델

7개 도메인 전체의 테이블 스키마와 관계.

## 전체 관계도

```
roadmap_settings (1)
phases (4)
  └── categories (Phase당 4)
        └── roadmap_items (N)

asset_records (N)

exercise_logs (N)
sleep_logs (N)

book_records (N)
english_logs (N)

career_settings (1)
cf_ratings (N)

trips (N)
  ├── trip_checklist_items (N)   ON DELETE CASCADE
  └── trip_plan_items (N)        ON DELETE CASCADE
```

---

## Planner

### roadmap_settings
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | 항상 1 (단일 row) |
| start_date | date | 로드맵 전체 시작일 |

### phases
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| key | str | "p1" ~ "p4" |
| name | str | "Phase 1" |
| label | str | "기반 다지기" |
| order_index | int | 정렬 순서 |
| months | int | 단계 기간(월) |
| color | str | 텍스트 색상 (#hex) |
| bg | str | 배경 색상 (#hex) |

### categories
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| phase_id | int FK → phases | |
| icon | str | 이모지 ("💻") |
| title | str | "커리어" |
| subtitle | str | 부제목 |
| order_index | int | |

### roadmap_items
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| category_id | int FK → categories | |
| text | str | 항목 내용 |
| offset_months | float | Phase 시작 기준 오프셋 |
| is_completed | bool | 완료 여부 |
| order_index | int | |

**파생값 (DB 저장 X)**

| 파생값 | 계산식 |
|--------|--------|
| Phase.start_date | roadmap_settings.start_date + Σ(이전 Phase들의 months) |
| Item.deadline | Phase.start_date + offset_months개월 |

---

## Finance

### asset_records
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| record_date | date | 기록 날짜 |
| total_assets | int | 총 자산 (원) |
| monthly_income | int \| null | 월 소득 |
| monthly_expense | int \| null | 월 지출 |
| savings_rate | float \| null | 저축률 (%) |
| note | str \| null | 메모 |
| created_at | datetime | |

---

## Health

### exercise_logs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| log_date | date | |
| exercise_type | str | "달리기", "웨이트" 등 |
| duration_minutes | int | |
| note | str \| null | |
| created_at | datetime | |

### sleep_logs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| log_date | date | |
| sleep_hours | float | |
| quality | int | 1~5 점수 |
| note | str \| null | |
| created_at | datetime | |

---

## Growth

### book_records
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| title | str | 책 제목 |
| author | str \| null | |
| status | str | "reading" \| "completed" \| "planned" |
| start_date | date \| null | |
| end_date | date \| null | |
| rating | int \| null | 1~5 |
| note | str \| null | |
| created_at | datetime | |

### english_logs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| log_date | date | |
| activity_type | str | "단어", "듣기", "말하기" 등 |
| duration_minutes | int | |
| note | str \| null | |
| created_at | datetime | |

---

## Career

### career_settings
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | 항상 1 (단일 row) |
| cf_handle | str \| null | Codeforces 핸들 |

### cf_ratings
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| contest_date | date | |
| rating | int | |
| rank | str \| null | "pupil", "specialist" 등 |
| contest_name | str \| null | |
| created_at | datetime | |

---

## Travel

### trips
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| name | str | 여행 이름 |
| destination | str | 목적지 |
| start_date | date | |
| end_date | date | |
| status | str | "planned" \| "ongoing" \| "completed" |
| note | str \| null | |
| created_at | datetime | |

### trip_checklist_items
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| trip_id | int FK → trips ON DELETE CASCADE | |
| text | str | |
| is_checked | bool | |
| order_index | int | |

### trip_plan_items
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK | |
| trip_id | int FK → trips ON DELETE CASCADE | |
| day | int | 여행 N일차 |
| sort_order | int | 같은 날 내 순서 |
| time | str \| null | "09:00" |
| title | str | |
| description | str \| null | |

**주의**: `trip_checklist_items`와 `trip_plan_items`는 FK에 `ON DELETE CASCADE` 적용.
`Trip` 삭제 시 연관 레코드 자동 삭제. SQLAlchemy relationship에 `passive_deletes=True` 설정.

---

## 관련 문서

- [adr/0003-sqlalchemy-async.md](../adr/0003-sqlalchemy-async.md)
- [adr/0005-Roadmap.md](../adr/0005-Roadmap.md)
- [architecture/system.md](./system.md)
