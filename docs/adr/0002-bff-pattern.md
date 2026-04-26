# ADR-0002: BFF 하이브리드 패턴

- 상태: 채택
- 일자: 2026-04-26

## 맥락

Life Dashboard는 두 종류의 화면을 가진다.

1. **홈 화면** — 4개 도메인(커리어·재테크·건강·자기계발) 요약을 한눈에
2. **상세 화면** — 각 도메인 페이지 (예: `/career`, `/finance`)

홈 화면은 여러 모듈의 데이터를 동시에 필요로 한다. 이를 클라이언트가 어떻게 받을 것인지 결정해야 한다.

## 선택지

### 1. 클라이언트 다중 호출

클라이언트가 모듈별 API를 각각 호출 후 조합.

```
GET /api/v1/career/summary
GET /api/v1/finance/summary
GET /api/v1/health/summary
GET /api/v1/growth/summary
```

- 장점: 서버는 단순, 모듈별 API만 제공
- 단점: 네트워크 왕복 N번, 부분 실패 처리를 클라이언트가 책임

### 2. 모놀리식 단일 엔드포인트

모든 화면용 데이터를 하나의 거대한 엔드포인트로 제공.

- 장점: 호출 1번
- 단점: 화면마다 다른 응답 구조 → 엔드포인트가 비대해짐. 상세 화면에 불필요한 데이터까지 받음

### 3. BFF (Backend For Frontend)

화면 단위로 집계 엔드포인트를 별도 모듈에서 제공. 상세 화면은 모듈 API 직접 호출.

```
[홈 화면]
GET /api/v1/dashboard/overview
  → dashboard 모듈이 내부적으로 career/finance/health/growth service를 호출

[상세 화면]
GET /api/v1/career/...
GET /api/v1/finance/...
```

- 장점: 화면 요구에 맞춘 응답, 서버에서 병렬 처리·부분 실패 제어, 모듈 책임 명확
- 단점: 집계 모듈(dashboard)이 추가됨

## 결정

**BFF 하이브리드 패턴** 을 채택한다.

- **홈 화면**: `dashboard` 모듈의 단일 집계 엔드포인트 호출
- **상세 화면**: 각 모듈의 API를 직접 호출

`dashboard` 모듈은 **read-only** 다. 자체 model을 가지지 않고, 다른 모듈의 service만 호출한다.

## 구현 규칙

### 집계 엔드포인트

```python
# dashboard/service.py
async def get_overview() -> OverviewResponse:
    career, finance, health, growth = await asyncio.gather(
        career_service.get_summary(),
        finance_service.get_summary(),
        health_service.get_summary(),
        growth_service.get_summary(),
        return_exceptions=True,  # 부분 실패 허용
    )
    return OverviewResponse(
        career=_handle(career),
        finance=_handle(finance),
        health=_handle(health),
        growth=_handle(growth),
    )
```

### 핵심 원칙

- `asyncio.gather(..., return_exceptions=True)` — 한 모듈이 실패해도 나머지는 응답
- 실패한 모듈은 응답 객체에 `null` 또는 에러 플래그로 표현
- `dashboard`는 다른 모듈의 **service layer만** 호출 (model·repository 직접 접근 금지)

## 근거

- **화면 요구사항이 모듈별로 다름** — 홈은 요약, 상세는 풀데이터. 한 엔드포인트로 둘 다 만족시키기 어렵다
- **부분 실패 내성** — 한 모듈 장애가 홈 전체를 망가뜨리지 않음
- **모듈 독립성 유지** — dashboard가 read-only이므로 모듈 간 결합이 service 레벨에서만 발생
- **확장성** — 새 도메인 추가 시 dashboard에 service 호출 한 줄만 추가

## 결과

### 장점

- 홈 화면 응답 시간 단축 (N번 왕복 → 1번)
- 부분 실패 시 사용자 경험 보존
- 모듈은 자기 책임만 가짐 (집계 로직은 dashboard가 책임)

### 단점 / 주의

- `dashboard` 모듈이 다른 모듈의 service에 의존하므로, 모듈 인터페이스 변경 시 함께 수정 필요
- 집계 응답 스키마가 커지면 분할 고려 (예: `/dashboard/overview` vs `/dashboard/widgets/{name}`)

## 관련 문서

- [ADR-0001 Modular Monolith](./0001-modular-monolith.md)
- ADR-0003 SQLAlchemy Async (작성 예정)
- [architecture/system.md](../architecture/system.md) (작성 예정)