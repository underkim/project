# 배포 관리 가이드

## 서비스 구성

| 서비스 | 역할 | URL | 무료 플랜 제한 |
|--------|------|-----|---------------|
| **Render** | FastAPI 백엔드 | https://life-dashboard-api-vt5n.onrender.com | 15분 미사용 시 슬립 |
| **Supabase** | PostgreSQL DB | db.zioteppguxfyjywbmdra.supabase.co | 7일 미사용 시 일시정지 |
| **Vercel** | Next.js 프론트엔드 | https://project-theta-ten-70.vercel.app | 무제한 |
| **cron-job.org** | Render 슬립 방지 핑 | - | 무료 |

---

## 재배포 방법

### 백엔드 (Render)
코드를 `main` 브랜치에 push하면 **자동 재배포**된다.

```bash
git push origin main
```

수동 재배포: Render 대시보드 → 서비스 → **Manual Deploy** 버튼

### 프론트엔드 (Vercel)
마찬가지로 `main` 브랜치 push 시 **자동 재배포**.

### 배포 순서 (백엔드 변경 시)
0. **배포 전 점검**: [pre-deploy-checklist.md](pre-deploy-checklist.md) 또는
   `powershell -File scripts/pre-deploy-check.ps1` 실행 (테스트·마이그레이션·빌드 일괄 검증)
1. `uv run pytest` — 로컬 테스트 통과 확인
2. `git push origin main` — Render + Vercel 자동 빌드 시작
3. Render 대시보드 → **Logs** 탭에서 빌드 로그 확인
4. `alembic upgrade head` → `uvicorn` 시작 순서로 로그 확인

---

## 환경변수 관리

### Render 환경변수
Render 대시보드 → 서비스 → **Environment** 탭

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DATABASE_URL` | Supabase Session Pooler URL | `postgresql+asyncpg://postgres.xxx:[PW]@aws-0-xxx.pooler.supabase.com:5432/postgres` |
| `JWT_SECRET` | JWT 서명 키 (랜덤 문자열) | `openssl rand -hex 32` 로 생성 |
| `ADMIN_USERNAME` | 관리자 아이디 | `admin` |
| `ADMIN_PASSWORD` | 관리자 비밀번호 | 안전한 비밀번호 |
| `GEMINI_API_KEY` | Google AI Studio 키 | `AIza...` |
| `CORS_ORIGINS` | 허용 오리진 | `http://localhost:3000,https://project-theta-ten-70.vercel.app` |

### Vercel 환경변수
Vercel 대시보드 → 프로젝트 → **Settings** → **Environment Variables**

| 변수명 | 값 |
|--------|-----|
| `NEXT_PUBLIC_API_URL` | `https://life-dashboard-api-vt5n.onrender.com` |

---

## Supabase 관리

### 프로젝트 일시정지 해제
무료 티어는 7일 미사용 시 자동 pause됨.

1. [supabase.com/dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 상태 확인 → "Paused" 표시 시 **Restore project** 클릭
3. 2~3분 대기 후 Render에서 Manual Deploy

### DB 비밀번호 변경 시
1. Supabase → Settings → Database → **Reset database password**
2. 새 비밀번호 복사
3. Render → Environment → `DATABASE_URL` 업데이트 (비밀번호 부분만 교체)
4. Render 자동 재배포 대기

### DB 직접 접속 (로컬에서 쿼리 실행)
Supabase → **SQL Editor** 탭에서 직접 쿼리 가능.

---

## Render 콜드 스타트 방지

### cron-job.org 설정
1. [cron-job.org](https://cron-job.org) 가입
2. **CREATE CRONJOB** 클릭
3. 설정:
   - URL: `https://life-dashboard-api-vt5n.onrender.com/api/v1/health`
   - Schedule: `*/14 * * * *` (매 14분)
4. 저장

설정 후 인스턴스가 항상 깨어있어 콜드 스타트 없이 응답.

---

## 트러블슈팅

### 배포 실패 시
1. Render → **Logs** 탭에서 에러 확인
2. 자주 발생하는 에러:

| 에러 | 원인 | 해결 |
|------|------|------|
| `ModuleNotFoundError` | 패키지 누락 | `pyproject.toml`에 추가 후 push |
| `Network is unreachable` | Supabase 일시정지 또는 IPv6 문제 | Supabase 복구 또는 Session Pooler URL 사용 |
| `alembic upgrade head` 실패 | DB 연결 불가 | `DATABASE_URL` 환경변수 확인 |
| `CORS error` (프론트) | CORS_ORIGINS 미설정 | Render에 `CORS_ORIGINS` 추가 |

### 로컬 개발 중 프로덕션 DB 연결
```bash
# .env 파일에서 DATABASE_URL을 Supabase URL로 임시 교체
DATABASE_URL=postgresql+asyncpg://postgres.xxx:[PW]@aws-0-xxx.pooler.supabase.com:5432/postgres
uv run uvicorn app.main:app --reload
```

### 마이그레이션 추가 시
```bash
# 1. 로컬에서 마이그레이션 파일 생성
uv run alembic revision --autogenerate -m "설명"

# 2. 로컬 테스트
uv run alembic upgrade head

# 3. push → Render 배포 시 자동으로 alembic upgrade head 실행
git push origin main
```

---

## 배포 URL 모음

```
백엔드 API:    https://life-dashboard-api-vt5n.onrender.com
API 문서:      https://life-dashboard-api-vt5n.onrender.com/docs
헬스체크:      https://life-dashboard-api-vt5n.onrender.com/api/v1/health
프론트엔드:    https://project-theta-ten-70.vercel.app
```
