# 하네스 엔지니어링 — 현재 상황

이 문서는 이 프로젝트에서 **Claude Code(AI 코딩 에이전트) 하네스**가 현재 어떻게 구성되어
있는지에 대한 스냅샷이다. 개념 설명은 `docs/harness-engineering.md` 참고.

## 구성 이전 상태

세션 시작 시점 `.claude/` 디렉토리는 다음이 전부였다:

```
.claude/
└── settings.json   # Bash 허용 3개뿐 (pytest/alembic/uvicorn)
```

- hooks 없음 — 세션 시작 시 백엔드(`uv sync`)/프론트엔드(`npm install`) 의존성이 준비되어
  있지 않아, 매 세션 수동 설치가 반복됨 (실제로 이 세션에서 `frontend/node_modules`가 없어
  수동 설치를 여러 번 반복함).
- `.claudeignore` 없음 — CLAUDE.md는 "`.env`, `*.db`, `.venv`, `__pycache__`는
  `.claudeignore` 등록 상태 유지"라고 명시하지만 실제 파일이 존재하지 않았음 (문서와 실제
  상태의 불일치).
- 프로젝트 전용 skill 없음 — CLAUDE.md에 "새 모듈 추가 패턴" 체크리스트가 텍스트로만 존재,
  실행 가능한 스캐폴딩 절차는 없었음.
- 커밋 전 자동 검증 없음 — CI(`ci.yml`)는 pytest/tsc/e2e를 돌리지만, 로컬(세션)에서 실패할
  코드가 커밋되는 것을 막는 장치는 없었음.

## 구성 이후 — 파일 인벤토리

```
.claude/
├── settings.json                       # 권한 + hooks 등록 (아래 상세)
├── hooks/
│   ├── session-start.sh                # SessionStart hook
│   └── pre-commit-check.sh             # PreToolUse(git commit) hook
└── skills/
    └── new-module/
        └── SKILL.md                    # "새 모듈 추가" 스캐폴딩 skill

.claudeignore                            # 신규 (repo root)
```

### `.claude/settings.json`

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(uv run pytest*)",
      "Bash(uv run alembic *)",
      "Bash(uv run uvicorn *)",
      "Bash(npx tsc --noEmit*)"          // 신규
    ]
  },
  "hooks": {
    "SessionStart": [ /* session-start.sh 등록 */ ],
    "PreToolUse": [ /* pre-commit-check.sh, matcher: Bash, if: "Bash(git commit*)" */ ]
  }
}
```

- `Bash(npx tsc --noEmit*)` 추가 근거: 이 세션의 실제 transcript를 스캔한 결과 `npx tsc
  --noEmit`이 6회 실행됨 (프론트엔드 변경 검증용, 읽기 전용, 부작용 없음). `git status`,
  `pgrep` 등 자주 나온 다른 명령은 Claude Code가 이미 내장 read-only 판정으로 자동
  허용하므로 추가하지 않음. `curl`, `python3 -c`, `git commit/push` 등은 상태를 변경하거나
  임의 코드 실행에 해당해 allowlist에서 제외.

### `.claude/hooks/session-start.sh`

- 이벤트: `SessionStart`
- 조건: `$CLAUDE_CODE_REMOTE == true`일 때만 실행 (Claude Code **on the web**, 즉 매번
  컨테이너가 새로 뜨는 원격 세션 한정 — 로컬 개발 환경은 이미 의존성이 있으므로 스킵)
- 동작: `uv sync` → `cd frontend && npm install`
- 실행 모드: **동기(synchronous)**. 세션이 이 스크립트가 끝날 때까지 대기한 뒤 시작된다.
  - 장점: 세션이 시작되자마자 pytest/tsc/playwright를 바로 실행할 수 있음이 보장됨
    (의존성 미설치로 인한 경합 상태 없음)
  - 단점: 세션 시작이 의존성 설치 시간만큼 늦어짐 (이 리포 기준 체감 수십 초)
  - 필요 시 `echo '{"async": true, "asyncTimeout": 300000}'`를 스크립트 맨 위에 추가해
    비동기로 전환 가능 (첫 몇 턴 동안 의존성이 아직 준비 안 됐을 race 감수)
- 검증: `CLAUDE_CODE_REMOTE=true bash .claude/hooks/session-start.sh` 직접 실행 →
  정상 종료 확인.

### `.claude/hooks/pre-commit-check.sh`

- 이벤트: `PreToolUse`, matcher `Bash`, `if: "Bash(git commit*)"` — `git commit`으로
  시작하는 Bash 호출에만 반응 (다른 git 명령·일반 Bash 호출에는 전혀 개입하지 않음).
- 동작: `uv run pytest -q` → 실패 시 `permissionDecision: "deny"`로 커밋 차단.
  통과하면 `cd frontend && npx tsc --noEmit` → 실패 시 마찬가지로 차단.
  둘 다 통과하면 아무 출력 없이 종료(허용).
- CI(`.github/workflows/ci.yml`)의 `test`/`typecheck` job과 동일한 검사를 커밋 시점으로
  당겨온 것 — CI에서 떨어질 코드가 애초에 커밋되지 않도록 하는 게 목적.
- 트레이드오프: 커밋마다 전체 테스트 스위트(~35초) + tsc(~5초)가 실행됨. 빈번한 작은
  커밋을 할 경우 누적 지연이 체감될 수 있음. 필요 시 `.claude/settings.json`의 hooks.
  PreToolUse 항목을 지우거나 `if` 조건을 좁혀(예: 특정 브랜치만) 완화 가능.
- 검증: 정상 상태에서 실행 → 조용히 exit 0. `tests/test_finance.py`에 실패하는 테스트를
  임시로 추가해 실행 → `deny` JSON과 실패 로그가 정확히 출력됨을 확인 후 원상 복구.

### `.claudeignore`

`.env`, `*.db`, `.venv/`, `__pycache__/`, `frontend/node_modules/`,
`frontend/.next/` 등 등록 — CLAUDE.md가 문서화하고 있던 상태를 실제로 맞춤.

### `.claude/skills/new-module/SKILL.md`

CLAUDE.md의 "새 모듈 추가 패턴" 절을 실행 가능한 skill로 변환. `/new-module` 또는 "새 모듈
추가해줘" 같은 요청 시 자동으로 로드되어, 백엔드(models→schemas→service→router→
main.py 등록) → 마이그레이션(dialect 가드, RLS 포함) → 테스트 → 프론트엔드 → 대시보드
연동(선택) → AI 연동(선택) → CSV 내보내기(선택) 순서를 안내한다.

## 기존 CI와의 관계

| 검사 | 위치 | 시점 |
|---|---|---|
| `uv run pytest` | `pre-commit-check.sh` + `ci.yml` `test` job | 커밋 시 (로컬/세션) + push/PR 시 (CI) |
| `npx tsc --noEmit` | `pre-commit-check.sh` + `ci.yml` `typecheck` job | 동일 |
| Playwright e2e | `ci.yml` `e2e` job만 | push/PR 시 (CI만 — 로컬 훅에는 미포함, 실행 시간이 길어 커밋마다 돌리기엔 과함) |

## 커버되지 않은 것 (의도적으로 보류)

- **PostToolUse 자동 포맷팅** — 이 프로젝트에 별도 formatter 설정(prettier/black 등)이
  없어서 구성하지 않음. 도입 시 `docs/harness-engineering.md`의 훅 패턴 참고해 추가 가능.
- **frontend eslint 훅** — `package.json`에 `lint` 스크립트가 있으나 훅으로 자동화하지
  않음 (필요성 낮다고 판단, 커밋 차단 항목이 늘어나는 것에 대한 사용자 확인 필요).
- **git push 시점 검사** — pre-commit 훅으로 이미 커버되어 중복 실행 방지 차원에서 생략.
- **subagent 정의(.claude/agents/)** — 이 프로젝트 규모(단일 사용자 포트폴리오)에서는
  범용 Explore/Plan 등 기본 subagent로 충분하다고 판단, 프로젝트 전용 subagent는 아직
  만들지 않음.

## 업데이트: 라이브 개발 현황 대시보드 (`devstatus` 모듈)

이 문서(정적 스냅샷)와 별개로, `docs/tasks/`(태스크 상태)와 `.claude/`(하네스 설정 그
자체)를 **실시간으로 읽어 보여주는** 모듈을 추가했다:

- 백엔드: `app/modules/devstatus/` — DB를 쓰지 않고 파일시스템(`docs/tasks/active|done`,
  `.claude/settings.json`, `.claude/hooks/`, `.claude/skills/`, `docs/dev-log/`)과 `git log`를
  직접 읽어 `GET /api/v1/devstatus/overview`로 반환.
- 프론트엔드: `/devstatus` 페이지 — 태스크 상태별 카운트, 활성/완료 태스크 목록, 하네스
  상태(권한 allowlist 개수, 등록된 hooks, skills 목록), git 브랜치/최근 커밋, 최근
  dev-log를 한 화면에서 확인.
- **탈부착**: `app/core/config.py`의 `enable_devstatus_module` (env: `ENABLE_DEVSTATUS_MODULE`,
  기본 `true`)로 제어. `false`로 설정하면 `main.py`가 라우터 자체를 등록하지 않아
  `/api/v1/devstatus/*`가 404가 되고, 프론트엔드는 이를 감지해 "비활성화됨" 상태를
  보여준다 — 코드 수정 없이 환경변수 하나로 켜고 끌 수 있다.
- `docs/tasks/count-tasks.ps1`(PowerShell)과 동일한 카운트를 제공하지만 플랫폼 제약이 없다.

**주의**: 이 문서(`harness-current-state.md`)는 특정 시점의 스냅샷이라 시간이 지나면
내용이 낡을 수 있다. 하네스의 **실제 현재 상태**(권한 개수, hooks, skills 목록)는
`/devstatus` 페이지나 `GET /api/v1/devstatus/overview`가 항상 최신값을 보여준다.

## 업데이트: 실시간 작업 로그 (`GET /api/v1/devstatus/activity`)

`overview`가 커밋된 결과(태스크 상태, git log 등)만 보여주는 것과 달리, `activity` 엔드포인트는
`.claude/state/activity-log.json`을 읽어 **진행 중인 작업의 체크포인트 진행 상황**을 보여준다.
Claude Code는 규모 있는 작업을 시작하기 전에 이 파일에 단계 목록을 적어두고, 각 단계를 마칠
때마다 다시 써서 갱신한다 (컨벤션은 `AGENTS.md`의 "Live Activity Log" 절 참고).

배포 지연(커밋→push→Render/Vercel 재배포)이 있는 구조이므로 완전한 실시간은 아니지만,
로그 파일만 변경된 커밋은 `pre-commit-check.sh`가 pytest/tsc를 생략하고 즉시 통과시키므로
(수십 초가 아니라 수십 밀리초) 체크포인트마다 커밋·push해도 부담이 없다. `/devstatus`
페이지는 이 엔드포인트를 8초 주기로 폴링해 자동 갱신한다.
