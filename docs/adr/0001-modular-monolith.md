# ADR-0001: Modular Monolith 채택

- 상태: 채택
- 일자: 2026-04-26

## 맥락

Life Dashboard는 4개 도메인(커리어·재테크·건강·자기계발) + 인증 + 집계로 구성된다.
프로젝트 시작 시점에 코드 구조를 결정해야 한다.

## 선택지

### 1. 단일 모놀리스 (Layered)

하나의 애플리케이션이 단일 코드베이스 + 단일 배포 단위. 코드는 **계층별로** 묶는다.

```
app/
├── controllers/   # 모든 도메인의 controller
├── services/      # 모든 도메인의 service
└── models/        # 모든 도메인의 model
```

- 장점: 구조 단순, 진입 비용 낮음
- 단점: 도메인 경계가 흐려져 코드가 커질수록 파일 찾기·책임 분리가 어려워짐

### 2. Modular Monolith (Package by Feature)

배포는 모놀리스처럼 단일이지만, 코드는 **도메인(모듈)별로** 묶는다.

```
app/
├── auth/
│   ├── router.py
│   ├── service.py
│   └── model.py
├── planner/
│   ├── router.py
│   ├── service.py
│   └── model.py
└── ...
```

- 장점: 도메인 경계 명확, 단일 배포의 단순함 유지, 추후 MSA 전환 용이
- 단점: 모듈 간 통신 규칙을 강제할 도구가 없어 규약으로 관리해야 함

### 3. MSA (Microservices)

모듈마다 독립 서비스 + 독립 DB.

```
[auth 서버] [planner 서버] [career 서버] ...
     ↕            ↕              ↕
[auth DB]   [planner DB]   [career DB]
```

- 장점: 서비스별 독립 배포·확장
- 단점: 네트워크·분산 트랜잭션·배포 파이프라인 등 운영 복잡도 큼

## 결정

**Modular Monolith (Package by Feature)** 를 채택한다.

```
app/
├── core/        # 공통 설정·DB·예외
├── auth/
├── planner/
├── career/
├── finance/
├── health/
├── growth/
└── dashboard/   # read-only 집계 BFF
```

모듈 간 통신은 **service layer만 통과**한다. 다른 모듈의 model을 직접 import하지 않는다.

## 근거

- **단일 개발자 + 학습 프로젝트** — MSA의 운영 복잡도(배포·네트워크·트랜잭션)는 학습 비용 대비 이득이 적다
- **도메인 경계가 뚜렷** — 커리어 / 재테크 / 건강 / 자기계발은 서로 침범하지 않는다. Layered 구조는 이 경계를 흐린다
- **점진적 전환 가능** — 모듈 경계가 잘 잡혀 있으면, 트래픽이 커지는 모듈만 떼어내 MSA로 전환할 수 있다 (Modular Monolith가 "MSA로 가는 안전한 출발점"이라 불리는 이유)
- **포트폴리오 가치** — Modular Monolith + BFF 조합은 실무 트렌드와 일치하고, 설계 의도를 설명하기 좋다

## 결과

### 장점

- 도메인별 응집도 ↑, 모듈 간 결합도 ↓
- 테스트가 모듈 단위로 깔끔하게 분리됨
- 추후 MSA 전환 시 모듈을 그대로 떼어내기 쉬움

### 단점 / 주의

- 모듈 간 통신 규칙(service layer 경유)을 강제할 도구는 없음 → 코드 리뷰·규약으로 관리
- 공통 model(예: User)이 여러 모듈에서 필요한 경우 위치 결정에 신중해야 함 → core 또는 auth에 두고 ID로만 참조

## 관련 문서

- ADR-0002 BFF 패턴 (작성 예정)
- ADR-0003 SQLAlchemy Async (작성 예정)
- [architecture/system.md](../architecture/system.md) (작성 예정)