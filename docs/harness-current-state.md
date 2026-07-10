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
│   ├── pre-commit-check.sh             # PreToolUse(git commit) hook
│   ├── post-edit-eslint.sh             # PostToolUse(Write|Edit) hook — prettier + eslint
│   └── pre-push-e2e.sh                 # PreToolUse(git push) hook — Playwright e2e
├── agents/
│   └── life-dashboard-reviewer.md      # 프로젝트 전용 subagent
├── skills/
│   └── new-module/
│       └── SKILL.md                    # "새 모듈 추가" 스캐폴딩 skill
└── state/
    └── activity-log.json               # 실시간 작업 체크포인트 로그

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
      "Bash(npx tsc --noEmit*)"
    ]
  },
  "hooks": {
    "SessionStart": [ /* session-start.sh 등록 */ ],
    "PreToolUse": [
      /* pre-commit-check.sh, matcher: Bash, if: "Bash(git commit*)" */
      /* pre-push-e2e.sh,    matcher: Bash, if: "Bash(git push*)"   — 작성·검증 완료,
         settings.json 등록은 self-modification 정책상 사용자의 명시적 채팅 확인 대기 중
         (스크립트 자체는 .claude/hooks/pre-push-e2e.sh에 존재하며 단독 실행 시 정상 동작함) */
    ],
    "PostToolUse": [ /* post-edit-eslint.sh, matcher: Write|Edit */ ]
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

### `.claude/hooks/post-edit-eslint.sh`

- 이벤트: `PostToolUse`, matcher `Write|Edit` — 모든 Write/Edit 호출마다 실행되지만,
  대상이 `frontend/` 아래 `.ts`/`.tsx` 파일이 아니면 훅 스크립트 자체가 즉시 종료해
  다른 파일 편집(백엔드 Python, docs 등)에는 지연이 전혀 없음.
- 동작: 편집된 파일에 `npx eslint --fix`를 실행해 자동 수정 가능한 건 바로 고치고,
  남은 경고/오류가 있으면 `hookSpecificOutput.additionalContext`로 대화에 즉시
  주입 — Claude Code가 다음 턴을 기다리지 않고 바로 인지하고 고칠 수 있다.
- **주의**: 이 프로젝트 CI(`ci.yml`)는 lint 단계 자체가 없고, ESLint는 기본적으로
  경고(warning)에 대해 0이 아닌 종료 코드를 반환하지 않는다. 그래서 종료 코드가 아니라
  **출력이 비어 있는지**로 판단한다 (`[ -n "$output" ]`) — 그렇지 않으면
  `no-unused-vars`, `exhaustive-deps` 같은 흔한 경고가 조용히 통과해버린다.
- 검증: 정상 파일 → 무출력. `no-unused-vars`를 유발하는 변수를 임시로 추가한 실제
  Edit 호출로 실제 세션에서 훅이 라이브로 발동해 경고가 대화에 그대로 주입되는 것까지
  확인 후 원복.

### Prettier (`frontend/.prettierrc.json`, `.prettierignore`)

- 기존 코드 스타일을 샘플링해(`lib/api.ts` 기준 single-quote 63 vs double-quote 1) 설정 도출:
  `singleQuote: true`, `semi: true`, `trailingComma: "all"`, `printWidth: 100`.
- 도입 시 전체 코드베이스에 `npx prettier --write .` 1회 실행 후 커밋 — 부작용으로 `useEffect`
  1-라인 콜백이 여러 줄로 재포맷되면서 그 바로 다음 줄을 겨냥하던
  `eslint-disable-next-line react-hooks/set-state-in-effect` 주석 3곳이 무효화됨(문제는
  `npx eslint .`를 전체 재실행해서 발견 — 처음엔 `tail -20`으로 앞부분 출력이 잘려 놓칠
  뻔함). 각 disable 주석을 "다음 줄"이 아니라 실제 위반 호출 바로 앞으로 옮겨 재포맷에
  안전하도록 수정.
- `package.json`에 `format`/`format:check` 스크립트 추가.
- `post-edit-eslint.sh`에 통합: eslint 실행 전에 `npx prettier --write "$rel"`을 먼저
  실행 — Write/Edit로 만들어진 파일이 항상 커밋 전에 이미 포맷돼 있도록.

### `.claude/hooks/pre-push-e2e.sh`

- 이벤트: `PreToolUse`, matcher `Bash`, `if: "Bash(git push*)"` (**settings.json 등록은
  아직 대기 중** — 아래 참고).
- 동작: 디스포저블 SQLite DB(`.e2e-push-check.db`) + 임시 포트(8911)의 백엔드를 띄우고
  `/api/v1/health`가 응답할 때까지 최대 30초 대기한 뒤 `npm run e2e`(Playwright, 30개
  테스트)를 실행. 실패하면 실패 로그 뒷부분을 담아 `permissionDecision: "deny"`로 push
  자체를 차단. `ci.yml`의 `e2e` job과 동일한 조건을 push 시점으로 당겨온 것.
- **이 세션 샌드박스 한정 이슈**: 이 환경에 사전 설치된 Chromium(`/opt/pw-browsers/`)의
  빌드 버전(1194)이 설치된 `@playwright/test` 버전이 기대하는 버전(1228)과 달라 기본
  설정으로는 `Executable doesn't exist` 오류가 남. 공식 지원 env var 오버라이드는 없어서
  (`playwright-core` 소스에서 확인), 커밋되는 `frontend/playwright.config.ts`(실제
  CI에서도 쓰는 공유 설정)는 건드리지 않고, 훅 실행 중에만 임시 파일
  (`frontend/.pw-sandbox.config.ts`, 실행 후 즉시 삭제)을 만들어 원본 설정을 그대로
  펼친 뒤 `use.launchOptions.executablePath`만 `/opt/pw-browsers/chromium`으로 덮어써서
  실행 — 이 경로가 없는 환경(실제 CI 등)에서는 오버라이드 자체를 건너뛰고 평소대로
  `npm run e2e`를 실행하므로 다른 환경에 영향 없음.
- 검증: `.claude/hooks/pre-push-e2e.sh`를 settings.json에 등록하지 않은 상태로 독립
  실행(`bash .claude/hooks/pre-push-e2e.sh`) → 30개 e2e 테스트 전부 통과 확인.
- **settings.json 등록 대기 사유**: 이 하네스는 `.claude/settings.json`이나 hook
  스크립트를 고치는 모든 변경에 대해, 자동 시스템 메시지(Stop hook 알림, 세션 재개
  알림 등)가 아니라 **채팅상의 명시적인 사용자 확인**을 요구하는 자체 규칙을 이번
  세션 내내 지켜왔다. 스크립트 작성·검증은 끝났지만 등록 자체는 이 규칙에 따라
  보류 중이다 (`git stash`에 보관: `pending-confirmation: pre-push-e2e hook registration
  in settings.json`).

### `.claude/agents/life-dashboard-reviewer.md`

프로젝트 전용 subagent. CLAUDE.md의 "자주 발생하는 실수 방지" 표에 있는 항목들
(async lazy loading, `ai/service.py`의 트랜잭션 중첩 금지·`flush()` 규칙, 모듈 간 경계,
마이그레이션 dialect 가드·RLS, cascade delete)을 코드 리뷰 관점에서 다시 확인하도록
설계됨. `tools: Read, Grep, Glob, Bash`만 부여(읽기 전용 — 코드를 직접 고치지 않고
findings만 보고). `app/modules/`, `app/core/`, `alembic/versions/` 아래 변경 후
커밋 전에 사용 권장.

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
| `npx prettier --write` + `npx eslint --fix` | `post-edit-eslint.sh` (파일 단위) | Write/Edit 직후 |
| Playwright e2e | `pre-push-e2e.sh`(등록 대기) + `ci.yml` `e2e` job | push 시 (로컬 훅, settings.json 등록 완료 후) + push/PR 시 (CI) |

## 커버되지 않은 것 / 대기 중인 것

- **`pre-push-e2e.sh`의 settings.json 등록** — 스크립트 작성·독립 검증(30개 e2e 통과)까지
  끝났지만, self-modification 확인 정책에 따라 채팅상의 명시적 사용자 확인을 기다리는 중.
  등록되기 전까지는 이 훅이 실제 `git push` 시 동작하지 않는다(파일만 존재).
- **backend/`ai/service.py` 등의 정적 분석 자동화** — `life-dashboard-reviewer` subagent가
  이 역할을 하지만, 훅처럼 자동 트리거되지 않고 명시적으로 호출해야 함 (Task 도구로
  subagent를 부르거나, "life-dashboard-reviewer로 리뷰해줘" 같은 요청 시).

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
