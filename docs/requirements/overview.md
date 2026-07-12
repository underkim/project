# Life Dashboard — 프로젝트 개요

## 목적

5년 라이프 로드맵을 7개 도메인으로 관리하는 개인 풀스택 대시보드.
단일 사용자 기준, 학습 목적 겸 포트폴리오.

## 도메인

| 도메인 | 모듈 | 핵심 기능 |
|--------|------|-----------|
| 플래너 | `planner` | Phase·Category·Item 계층 로드맵, 마감일 추적 |
| 재테크 | `finance` | 자산 기록 CRUD, 저축률 요약, CSV 내보내기 |
| 건강 | `health` | 운동·수면 기록 CRUD, 주간 요약, CSV 내보내기 |
| 나의 기록 | `trackers` | 사용자 정의 숫자·텍스트·완료 여부 추적 항목과 날짜별 기록 |
| 여행 | `travel` | 여행 CRUD, 체크리스트, 일정(Day별 plan) 탭 |
| AI | `ai` | Gemini 자연어 기록·수정·삭제, 주간 리포트 생성 |

## 핵심 기능

### 대시보드 홈
- `GET /api/v1/dashboard/overview` — 7개 도메인 요약을 단일 호출로 집계
- 각 도메인의 최신 스냅샷(이번 주·이번 달 통계) 표시

### AI 자연어 인터페이스
- "오늘 운동 30분 했어" → `health.exercise` 레코드 자동 생성
- "어제 수면 기록 삭제해줘" → 삭제 확인 → 실행
- 주간 리포트: 7개 도메인 데이터를 Gemini로 요약

### 데이터 내보내기
- 도메인별 CSV 내보내기 (UTF-8 BOM, Excel 호환)

## 기술 제약

- **단일 사용자** — user_id 컬럼 없음, 추후 멀티유저 전환 시 일괄 추가 필요
- **SQLite (개발)** / **PostgreSQL (프로덕션)** — `DATABASE_URL` 환경변수로 전환
- **비동기 전체** — SQLAlchemy 2.0 async + asyncpg, Lazy loading 금지

## 범위 외 (V1)

- 푸시 알림, 일정 리마인더
- 소셜 로그인 (현재 단일 어드민 계정)
- 모바일 앱
- 다중 Roadmap / 멀티유저

## 관련 문서

- [architecture/system.md](../architecture/system.md) — 시스템 구조
- [architecture/data-model.md](../architecture/data-model.md) — 데이터 모델
- [adr/](../adr) — 주요 기술 결정 기록
