# FastAPI + uvicorn + ASGI 동작 원리

> 작성일: 2026-05-10  
> 목적: 서버/앱/표준의 책임 분리를 명확히 이해

---

## 1. 핵심 한 문장

> **FastAPI**는 ASGI 표준을 따르는 **앱(받는 쪽)**, **uvicorn**은 HTTP를 ASGI로 변환해 호출하는 **서버(호출하는 쪽)**. 둘은 ASGI 표준이라는 계약서로 연결된다.

---

## 2. 컴포넌트별 책임

| 컴포넌트 | 정체 | 책임 |
|---|---|---|
| **OS 커널** | 운영체제 | TCP 소켓 관리, IOCP/epoll/kqueue로 이벤트 알림 |
| **asyncio** | Python 표준 라이브러리 | `socket()`, `bind()`, `listen()`, `accept()` 시스콜 호출. 이벤트 루프 |
| **uvicorn** | ASGI 서버 패키지 | `loop.create_server()` 호출. HTTP 바이트 ↔ ASGI scope 변환 |
| **FastAPI 앱** | 메모리상 객체 | ASGI scope의 path 보고 어떤 함수 호출할지 결정 |
| **내 코드 (health 함수 등)** | 비즈니스 로직 | 실제 요청 처리 |

---

## 3. 두 단계 변환 흐름

```
[외부]   HTTP    [uvicorn]   ASGI    [FastAPI]   함수 호출   [내 함수]
        ─────► 단계 1 ─────────► 단계 2 ──────────►
```

### 단계 1: uvicorn 담당 (HTTP ↔ ASGI)

```
HTTP 바이트 → ASGI scope dict
"GET /api/v1/health HTTP/1.1\r\n..."
   ↓
{"type":"http", "method":"GET", "path":"/api/v1/health", ...}
```

### 단계 2: FastAPI 담당 (ASGI ↔ 내 함수)

```
ASGI scope dict → 라우트 매칭 → 함수 호출
{"path":"/api/v1/health", ...}
   ↓ 라우트 테이블 검색
   └─ /api/v1/health 매칭 → health 함수 발견
   ↓
await health()
```

---

## 4. ASGI 표준이란

**Asynchronous Server Gateway Interface** — 비동기 서버와 앱이 통신하는 표준 약속.

ASGI 앱은 다음 시그니처의 callable:

```python
async def app(scope, receive, send):
    # scope: 요청 정보 dict
    # receive: 요청 본문 가져오는 async 함수
    # send: 응답 내보내는 async 함수
    ...
```

이 시그니처를 따르면 어떤 ASGI 서버든 호출 가능. **표준이 양쪽을 분리**해 호환성 보장.

---

## 5. 시나리오 1: 서버 모드 (`uv run uvicorn app.main:app --reload`)

### 프로세스 구조

```
[uv PID 1000]               의존성 동기화 후 자식 실행
   ↓
[uvicorn reloader PID 1001] watchfiles로 .py 감시
   ↓
[uvicorn worker PID 1002]   실제 서버. 소켓 점유. 요청 처리
```

### 시작 시 일어나는 일 (PID 1002)

```python
1. importlib.import_module("app.main")
   → app/main.py 실행
   → from app.api.v1.health import router (router 객체 메모리 생성)
   → from app.core.config import settings (.env 로드)
   → app = create_app() (FastAPI 인스턴스 생성)

2. getattr(module, "app") → app 객체 획득

3. asyncio loop.create_server() 호출
   → 내부에서 socket() bind() listen() 시스콜
   → 포트 8000 점유

4. 무한 루프 진입 (accept 대기)
```

### 요청 도착 시

```
[OS] TCP SYN 받음 → 소켓 큐에 push
   ↓
[asyncio] IOCP/epoll이 알림 → loop._accept_connection()
   ↓
[uvicorn] HttpToolsProtocol.data_received(bytes)
   ↓ httptools로 HTTP 파싱
   ↓ ASGI scope dict 생성
   ↓ await app(scope, receive, send)
   ↓
[FastAPI] 라우트 테이블 검색 → health 함수 매칭
   ↓ await health()
   ↓ {"status":"ok"} 반환
   ↓ JSONResponse 생성 → send 콜백으로 전달
   ↓
[uvicorn] 응답 메시지 → HTTP 직렬화 → 소켓에 write()
   ↓
[브라우저] JSON 받음
```

**파일 시스템은 시작 시 1번만 읽음**. 이후 요청 처리는 전부 메모리에서.

---

## 6. 시나리오 2: 테스트 모드 (`uv run pytest`)

서버 모드와 **완전히 독립된 새 프로세스**. uvicorn 안 씀.

### 프로세스 구조

```
[uv PID 2000] → [pytest PID 2001]
```

### 동작

```python
1. pytest가 conftest.py 실행
   → from app.main import app (서버 모드와 동일하게 import)
   → app 객체 메모리에 생성됨
   → 단, 소켓은 안 만듦 (uvicorn 안 실행되므로)

2. test 함수 실행
   client = TestClient(app)
   client.get("/api/v1/health")
       ↓
   TestClient 내부:
       scope = {"type":"http", "method":"GET", "path":"/api/v1/health", ...}
       메시지 큐 만듦
       event_loop.run_until_complete(app(scope, receive, send))
           ↑ ASGI 시그니처로 app 직접 호출
   ↓
   응답 메시지 → Response 객체로 반환

3. assert로 검증
```

**HTTP 파싱/소켓이 없음**. 단계 1을 건너뛰고 단계 2부터 시작.

### 두 시나리오 비교

| 항목 | 서버 모드 | 테스트 모드 |
|---|---|---|
| 프로세스 수 | 3개 (uv + reloader + worker) | 2개 (uv + pytest) |
| `app` 객체 | 메모리에 생성 | 메모리에 생성 |
| 소켓 생성 | O (포트 8000) | X |
| HTTP 파싱 | O (httptools) | X |
| `await app(scope, receive, send)` | uvicorn worker가 호출 | TestClient가 호출 |
| 외부 접속 | 가능 | 불가 |
| 종료 | Ctrl+C까지 무한 | 테스트 끝나면 즉시 |

**둘 다 결국 같은 짓**: ASGI 시그니처로 `app` 호출. **차이는 호출 전 HTTP/소켓 처리 유무**.

---

## 7. ASGI 서버 종류

uvicorn은 ASGI 서버의 한 구현체일 뿐. 다른 선택지도 있음.

| 이름 | 특징 | 주 사용처 |
|---|---|---|
| **uvicorn** | 가장 대중적. uvloop+httptools로 빠름 | FastAPI 표준 조합 |
| **hypercorn** | HTTP/2, HTTP/3, WebSocket 모두 지원 | HTTP/2 필요 시 |
| **daphne** | Django Channels 팀 제작 | Django Channels |
| **granian** | Rust로 짠 신흥 서버. 가장 빠름 | 성능 극한 추구 |

ASGI 표준만 지키면 어떤 서버든 FastAPI 동작. 코드 변경 없이 서버만 교체 가능.

---

## 8. WSGI vs ASGI

| 표준 | 시그니처 | 동기/비동기 | 대표 서버 | 대표 프레임워크 |
|---|---|---|---|---|
| WSGI | `def app(environ, start_response)` | 동기 | gunicorn, uWSGI, waitress | Flask, Django(전통) |
| ASGI | `async def app(scope, receive, send)` | 비동기 | uvicorn, hypercorn, daphne | FastAPI, Starlette |

**시그니처가 다르므로 WSGI 서버는 ASGI 앱(FastAPI) 호출 못함.**

예외: `gunicorn -k uvicorn.workers.UvicornWorker app.main:app` — gunicorn이 uvicorn을 워커로 감싸면 가능. 운영 환경 표준 패턴.

---

## 9. 자주 헷갈리는 점

### Q1. `app`이 서버인가?

❌ 아님. `app`은 **메모리상 파이썬 객체**. 라우트 테이블과 미들웨어 체인을 들고 있는 callable. 서버는 따로 필요(uvicorn).

### Q2. uvicorn이 파일 시스템에 접근하게 해주나?

❌ 아님. **프로세스 시작 시 .py 파일을 1번만 import**. 이후엔 메모리상 객체만 사용. uvicorn은 외부 HTTP를 메모리상 app 객체에 전달하는 어댑터.

### Q3. uvicorn 없이 FastAPI 못 쓰나?

❌ 아님. ASGI 호환 서버라면 무엇이든 가능 (hypercorn, daphne, granian). 직접 짠 소켓 코드도 ASGI 시그니처로 호출하면 가능. uvicorn은 단지 가장 흔한 선택지일 뿐.

### Q4. TestClient는 진짜 HTTP를 쓰나?

❌ 아님. **메모리에서 ASGI 시그니처로 app 직접 호출**. 소켓도 포트도 안 씀. 그래서 빠르고 서버 안 띄워도 됨.

### Q5. uvicorn은 데몬인가?

❌ 아님. 명령 단위 일회성 프로세스. Ctrl+C로 종료. uvicorn이 띄운 **워커 프로세스**가 백그라운드처럼 보일 뿐.

---

## 10. 핵심 요약

```
[디스크의 .py 파일]
   ↓ 프로세스 시작 시 1회 import
[메모리의 app 객체] (FastAPI 인스턴스)
   ↑
   ASGI 시그니처로 호출되면 동작
   ↑
[호출자 두 종류]
   ├─ uvicorn: 외부 HTTP를 ASGI로 변환해 호출 (실제 서버)
   └─ TestClient: 메모리에서 직접 ASGI 호출 (테스트)
```

**FastAPI = 받는 쪽**, **uvicorn = 호출하는 쪽**. 둘 사이를 잇는 게 **ASGI 표준**.

---

## 참고

- ASGI 공식 명세: https://asgi.readthedocs.io
- uvicorn 공식: https://www.uvicorn.org
- FastAPI 공식: https://fastapi.tiangolo.com

