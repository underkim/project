# Life Dashboard

5년 라이프 로드맵을 4가지 영역(커리어·재테크·건강·자기계발)으로 관리하는 백엔드 프로젝트.

## 상태

🚧 개발 중 (2026-04 ~ )

## 기술 스택

- **Backend**: FastAPI, Pydantic v2
- **DB**: PostgreSQL, SQLAlchemy 2.0 (async), Alembic
- **Infra**: Docker Compose, GitHub Actions, Render
- **Test**: pytest

## 아키텍처

- Modular Monolith (Package by Feature)
- BFF 하이브리드 패턴 (집계 엔드포인트 + 모듈별 직접 호출)
- 모듈 간 통신은 service layer만 통과

상세: [docs/](./docs)

## 모듈

| 모듈 | 역할 | 상태 |
|------|------|------|
| core | 공통 설정·DB·예외 | 예정 |
| auth | JWT 인증 | 예정 |
| planner | 로드맵·Phase·Item 관리 | 작업 중 |
| career | CF·GitHub·블로그 RSS | 예정 |
| finance | 자산·저축률 | 예정 |
| health | 운동·수면 | 예정 |
| growth | 독서·영어 | 예정 |
| dashboard | 집계 BFF (read-only) | 예정 |

## 문서

- [요구사항](./docs/requirements)
- [아키텍처](./docs/architecture)
- [결정 기록 (ADR)](./docs/adr)
- [개발 일지](./docs/dev-log)

## 라이선스

MIT