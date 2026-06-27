# AGENTS.md - Life Dashboard Agent Workflow

## 목적

이 문서는 Life Dashboard 저장소에서 사용자, Codex, Claude Code가 같은 기준으로 협업하기 위한 운영 규칙을 정의한다.
기능 구현 자체보다 작업의 상태, 책임, 산출물 흐름을 명확히 하는 것이 목적이다.

## 역할 분리

### 사용자

- 제품 방향과 요구사항의 최종 결정권자다.
- Codex가 작성한 task 문서를 검토한다.
- 구현할 작업을 명시적으로 승인할 때 task 상태를 `approved`로 변경하거나 변경을 지시한다.
- PR 리뷰 결과를 확인하고 merge 여부를 결정한다.

### Codex

- 기본 역할은 설계자이자 작업 계획자다.
- 요구사항 분석, 현재 구조 분석, 영향 범위 분석, DB/API/Frontend/Test 설계를 담당한다.
- 구현자가 바로 작업할 수 있도록 `docs/tasks/active/` 아래에 task 문서를 작성하거나 갱신한다.
- 사용자가 명시적으로 승인하지 않는 한 task 상태를 `approved`로 만들지 않는다.
- 일반 기능 작업에서는 실제 기능 코드, 테스트, 커밋, PR을 수행하지 않는다.

### Claude Code

- 기본 역할은 구현자다.
- `status: approved`인 task 문서를 기준으로 작업한다.
- 구현 시작 시 task 상태를 `working`으로 변경한다.
- 기능 코드 수정, 테스트 실행, 커밋, PR 생성을 담당한다.
- 구현 완료 후 task 상태, 브랜치, PR, 검증 결과를 task 문서에 기록한다.

## Task 문서 위치

새 작업은 다음 위치에 생성한다.

```text
docs/tasks/active/TASK-번호-기능명.md
```

예시:

```text
docs/tasks/active/TASK-001-travel-budget.md
```

완료 또는 보류된 작업은 상태에 맞게 이동한다.

- `docs/tasks/active/`: 초안, 승인, 구현 중, 리뷰 중 작업
- `docs/tasks/done/`: PR merge까지 완료된 작업
- `docs/tasks/blocked/`: 외부 결정이나 정보 부족으로 진행할 수 없는 작업

## Task 상태 흐름

```text
draft -> approved -> working -> implemented -> reviewed -> done
                       |
                       v
                    blocked
```

상태 의미:

- `draft`: Codex가 작성한 설계 초안
- `approved`: 사용자가 구현을 승인한 작업
- `working`: Claude Code가 구현 중인 작업
- `implemented`: 구현, 테스트, PR 생성이 완료된 작업
- `reviewed`: PR 리뷰가 완료된 작업
- `done`: PR merge가 완료된 작업
- `blocked`: 결정, 권한, 외부 정보 부족 등으로 진행할 수 없는 작업

## 승인 규칙

- Codex는 기본적으로 `status: draft` task만 작성한다.
- 사용자가 "승인", "approved로 변경", "구현 진행"처럼 명시적으로 지시한 경우에만 `approved`로 변경한다.
- Claude Code는 `approved` 상태가 아닌 task를 구현하지 않는다.
- 범위가 바뀌면 구현 전에 task 문서를 먼저 갱신한다.

## 저장소 아키텍처 기준

작업자는 항상 `CLAUDE.md`, `README.md`, `docs/adr/`를 우선 확인한다.

핵심 규칙:

- Modular Monolith 구조를 유지한다.
- 기능은 `app/modules/<domain>/` 단위로 관리한다.
- 모듈 간 직접 model 접근은 피하고 service layer를 우선 사용한다.
- `dashboard`는 read-only BFF 집계 모듈로 유지한다.
- SQLAlchemy async 환경에서 lazy loading을 금지한다.
- 관계 데이터는 `selectinload` 또는 `joinedload`로 명시 로딩한다.
- service가 자체 세션을 생성하지 않는다.
- `ai/service.py`의 트랜잭션 예외 규칙은 `CLAUDE.md`를 따른다.
- 프론트엔드는 `frontend/lib/api.ts`, `frontend/types/index.ts`, 기존 dashboard 페이지 패턴을 따른다.

## 보안 규칙

- `.env` 파일을 읽거나 출력하지 않는다.
- API 키, DB 비밀번호, JWT secret, 토큰 등 시크릿 값을 조회하거나 기록하지 않는다.
- 환경변수 값 자체를 사용자에게 요구하지 않는다.
- 인증, 권한, 삭제, 외부 연동 관련 변경은 task와 PR에서 보안 검토 항목을 명시한다.

## 작업 원칙

- 요구사항 범위를 벗어난 기능을 추가하지 않는다.
- 불필요한 리팩토링을 하지 않는다.
- 새 기능은 테스트 계획을 반드시 포함한다.
- 애매하거나 위험한 부분은 task 문서의 "결정 필요 사항"에 남긴다.
- 기존 코드 스타일과 문서 스타일을 우선 존중한다.

## 관련 문서

- `docs/agent-skills/codex-task-planner.md`
- `docs/agent-skills/claude-task-executor.md`
- `CLAUDE.md`
- `README.md`
- `docs/adr/0001-modular-monolith.md`
- `docs/adr/0002-bff-pattern.md`
- `docs/adr/0003-sqlalchemy-async.md`