# 배포 전 점검 체크리스트 (Pre-Deploy Checklist)

프로덕션(Render + Supabase + Vercel) 배포 전에 아래 항목을 순서대로 확인한다.
빠른 자동 검증은 `scripts/pre-deploy-check.ps1`(Windows) 또는 본 문서의 명령을 직접 실행한다.

> 보안: 이 문서와 스크립트는 환경변수 **이름만** 다룬다. 실제 값(비밀번호·키·DB URL)을
> 출력하거나 커밋하지 않는다.

## 1. 백엔드 검증

```bash
# 의존성 동기화
uv sync

# 전체 테스트 (mock DB 금지 — SQLite in-memory 테스트 설정)
uv run pytest

# 마이그레이션 헤드가 단일인지 확인 (다중 head면 머지 필요)
uv run alembic heads        # 단일 revision (head) 1줄만 나와야 함

# 적용 대기 중인 마이그레이션 미리보기 (실제 적용은 배포 시 자동)
uv run alembic history | head
```

체크:
- [ ] `uv run pytest` 전부 통과
- [ ] `alembic heads`가 **단일** head 출력 (분기 없음)
- [ ] 스키마를 바꿨다면 새 마이그레이션 파일이 커밋되어 있음
  - 예: 여행 위치/맛집 필드는 `d5e8f1a2b3c4_add_trip_location_and_restaurants.py`

## 2. 프론트엔드 검증

```bash
cd frontend
npm ci

npx tsc --noEmit        # 타입 체크
npm run lint            # ESLint (0 error 목표)
npm run build           # 프로덕션 빌드 (workspace root 경고 없어야 함)
```

체크:
- [ ] `tsc --noEmit` 통과
- [ ] `npm run lint` 0 error
- [ ] `npm run build` 성공 (standalone 출력)

## 3. E2E 스모크 (선택, 가능 시)

백엔드(`uv run uvicorn app.main:app`)와 프론트가 떠 있어야 한다.

```bash
cd frontend
npx playwright test --list      # 스펙 파싱 확인 (서버 불필요)
npm run e2e                      # 전체 스모크 (서버 필요)
```

체크:
- [ ] 핵심 경로 스모크 통과: 로그인 / 대시보드 개요·새로고침 / AI 모달 / 여행 지도·맛집

## 4. 환경변수 확인 (이름만 — 값은 각 플랫폼 콘솔에서 설정)

### Render (백엔드)
- [ ] `DATABASE_URL` — Supabase **Session Pooler** URL (Direct Connection은 IPv6라 무료 티어 불가)
- [ ] `JWT_SECRET` — 안전한 랜덤 값 (기본값 `change-me-...` 금지)
- [ ] `ADMIN_USERNAME`, `ADMIN_PASSWORD` — 기본값(`admin`/`password`) 금지
- [ ] `GEMINI_API_KEY` — Google AI Studio 키
- [ ] `CORS_ORIGINS` — Vercel 도메인 포함
- [ ] `DEBUG` — `false`

> 앱 시작 시 `JWT_SECRET`/`ADMIN_PASSWORD`가 기본값이면 경고를 출력한다
> (`app/core/config.py`). 배포 환경에서 이 경고가 보이면 즉시 교체.

### Vercel (프론트엔드)
- [ ] `NEXT_PUBLIC_API_URL` — Render 백엔드 URL

## 5. 배포 순서 (백엔드 스키마 변경 시)

1. 마이그레이션 파일 커밋 → push
2. Render 자동 배포 시 `alembic upgrade head` 실행됨 (수동 적용 불필요)
3. 백엔드 헬스 확인: `GET /api/v1/health` (DB ping 포함, 200이면 정상)
4. 프론트(Vercel)는 자동 재배포 — 빌드 성공 확인
5. 로그인 → 대시보드 개요 로드 → AI 모달 1회 스모크

체크:
- [ ] 마이그레이션 먼저 배포되어 적용됨
- [ ] `/api/v1/health` 200
- [ ] 로그인 및 대시보드 정상

## 6. 최종

- [ ] `.env`, 키, 비밀번호 등 민감정보가 커밋에 포함되지 않음 (`.claudeignore`/`.gitignore` 확인)
- [ ] `develop` → `main` 머지 후 배포 브랜치 최신화

자세한 재배포·트러블슈팅은 [deployment.md](deployment.md) 참고.
