# Claude Task Executor

## 목적

Claude Code는 Life Dashboard 저장소에서 구현자 역할을 담당한다.
`status: approved`인 task 문서를 기준으로 기능 코드 수정, 테스트, 커밋, PR 생성을 수행한다.

## 기본 책임

- 승인된 task 문서를 읽고 작업 범위를 확인한다.
- 구현 시작 시 task 상태를 `working`으로 변경한다.
- task에 적힌 수정 예상 파일과 구현 순서를 따른다.
- 기능 코드, 테스트, 문서 변경을 필요한 범위 안에서 수행한다.
- 검증 명령을 실행하고 결과를 task 문서에 기록한다.
- 커밋과 PR을 생성한 뒤 task 상태를 `implemented`로 변경한다.

## 작업 시작 조건

Claude Code는 다음 조건을 만족할 때만 구현한다.

- task 파일이 `docs/tasks/active/` 아래에 있다.
- task 상태가 `status: approved`다.
- 요구사항, 제외 범위, 결정 필요 사항이 구현 가능한 수준으로 정리되어 있다.

`draft`, `blocked`, `done` 상태의 task는 구현하지 않는다.

## 금지 사항

- `.env` 파일을 읽거나 출력하지 않는다.
- API 키, DB 비밀번호, 토큰, 시크릿을 조회하거나 기록하지 않는다.
- task 범위 밖 기능을 추가하지 않는다.
- 불필요한 리팩토링을 하지 않는다.
- 사용자가 요청하지 않은 파일 포맷 변경이나 대규모 정리를 하지 않는다.
- 기존 `CLAUDE.md`와 `README.md`는 task에서 명시하지 않는 한 수정하지 않는다.

## 구현 규칙

- `CLAUDE.md` 규칙을 최우선으로 따른다.
- 기존 코드 스타일과 모듈 패턴을 먼저 확인한다.
- Backend 기능은 `app/modules/<domain>/`의 `router.py`, `service.py`, `schemas.py`, `models.py` 패턴을 따른다.
- 모듈 간 직접 model 접근은 피하고 service layer를 우선 사용한다.
- `dashboard`는 read-only BFF 집계 모듈로 유지한다.
- SQLAlchemy async lazy loading을 금지한다.
- 관계 데이터는 `selectinload` 또는 `joinedload`로 명시 로딩한다.
- service가 자체 세션을 생성하지 않는다.
- 중첩 트랜잭션을 만들지 않는다.
- `ai/service.py`의 `_create`, `_update`, `_delete` 내부에서는 `session.begin()`을 사용하지 않는다.
- AI 다중 액션에서 create 후 필요한 경우 `flush()`를 호출한다.
- 프론트엔드는 `frontend/lib/api.ts`, `frontend/types/index.ts`, 기존 dashboard 페이지 스타일을 따른다.

## 테스트 규칙

task 문서의 테스트 계획을 우선 따른다.

일반 기준:

- 백엔드 기능 변경 시 관련 pytest를 실행한다.
- 프론트 타입 변경 시 TypeScript 검증을 실행한다.
- 주요 사용자 흐름 변경 시 Playwright E2E 필요 여부를 판단하고 task에 기록한다.
- 테스트를 실행하지 못한 경우 사유를 task와 PR에 명시한다.

## 커밋 및 PR 규칙

- 가능하면 task별 별도 브랜치를 사용한다.
- 커밋 메시지는 작업 범위가 드러나게 작성한다.
- PR 본문에는 다음을 포함한다.
  - 작업 요약
  - 변경 파일
  - 테스트 결과
  - 보안 또는 마이그레이션 영향
  - 리뷰 체크리스트

PR 생성 후 task 문서에 `branch`, `pr`, `implemented_at`을 기록한다.

## 상태 갱신 규칙

권장 흐름:

1. 구현 시작 전 `status: working`
2. 구현, 테스트, PR 생성 후 `status: implemented`
3. PR 리뷰 완료 후 `status: reviewed`
4. PR merge 후 `status: done`으로 변경하고 `docs/tasks/done/`으로 이동
5. 진행 불가 시 `status: blocked`로 변경하고 `docs/tasks/blocked/`로 이동

상태를 변경할 때는 날짜 필드도 함께 갱신한다.

## 완료 보고

Claude Code는 작업 완료 후 사용자에게 다음을 보고한다.

- 구현 요약
- 변경 파일
- 실행한 검증 명령과 결과
- 생성한 브랜치와 PR
- 남은 위험 또는 후속 작업