# Life Dashboard 개발 현황 — 데스크톱 모니터

Life Dashboard 저장소의 개발 현황(태스크 상태, `.claude/` 하네스 설정, 지금 진행 중인
작업 체크포인트)을 배포(Render/Vercel)와 무관하게 **GitHub 저장소에서 직접** 읽어
보여주는 독립 실행 프로그램입니다. 배포 앱과 완전히 분리되어 있어 커밋 후 재배포를
기다릴 필요 없이 `git push` 직후 곧바로 반영됩니다.

## 왜 별도 프로그램인가

- Life Dashboard 앱(`/devstatus` 페이지)은 배포된 백엔드를 통해 데이터를 보여주므로
  Render/Vercel 재배포 지연(수십 초~수 분)이 있습니다.
- 이 프로그램은 GitHub REST API를 직접 호출하므로 그 지연이 없고, Claude Code 세션의
  프로덕션 로그인 정보가 전혀 필요 없습니다 (본인 GitHub 계정의 Personal Access Token만
  사용).

## 요구 사항

- Python 3.10 이상 (Windows에 기본 설치되는 tkinter 포함 버전 — python.org 설치본은
  기본 포함)
- `pip install -r requirements.txt` (requests 패키지만 필요)

## 실행

```powershell
pip install -r requirements.txt
python devstatus_desktop.py
```

최초 실행 시 다음 정보를 입력받아 `%USERPROFILE%\.lifedashboard-status\config.json`
(다른 OS에서는 `~/.lifedashboard-status/config.json`)에 저장합니다. 이 파일은 저장소에
커밋되지 않습니다 (`.gitignore` 대상 아님 — 애초에 저장소 밖, 사용자 홈 디렉터리에
저장되므로 커밋될 일이 없습니다).

- **owner**: 저장소 소유자 (예: `underkim`)
- **repo**: 저장소 이름 (예: `project`)
- **token**: GitHub Personal Access Token — [Fine-grained
  token](https://github.com/settings/personal-access-tokens/new)을 만들고 이
  저장소에 대해 **Contents: Read-only** 권한만 부여하세요. 쓰기 권한은 필요 없습니다.

설정을 바꾸려면 저 config.json 파일을 직접 열어 수정하거나 삭제 후 재실행하세요.

## 화면 구성

- **지금 작업 중**: `.claude/state/activity-log.json`을 읽어 진행 중인 작업의
  체크포인트(완료✅/진행중🔵/대기⚪)를 보여줍니다. 진행 중인 작업이 없으면 "지금
  진행 중인 작업이 없습니다"로 표시됩니다.
- **태스크 현황**: `docs/tasks/active|done`의 상태별 개수.
- **활성 태스크**: draft/approved/working/blocked/implemented/reviewed 태스크 목록.
- **하단**: 브랜치·최근 커밋, 하네스 상태(권한 allowlist 개수, hooks, skills,
  `.claudeignore` 적용 여부) 요약.

기본적으로 8초마다 자동 새로고침합니다 (`config.json`의 `poll_seconds`로 조정 가능).

## Windows 실행 파일(.exe)로 만들기

이 도구는 Linux 개발 환경에서 작성되었고 Windows 바이너리는 Windows에서 직접
빌드해야 합니다 (PyInstaller는 크로스 컴파일을 지원하지 않음). Windows 머신에서:

```powershell
pip install -r requirements.txt pyinstaller
pyinstaller --onefile --windowed --name "LifeDashboardStatus" devstatus_desktop.py
```

`dist\LifeDashboardStatus.exe`가 생성됩니다. `--windowed`는 콘솔 창 없이 실행되게
합니다.

## 알려진 제약

- GitHub API 호출은 시간당 요청 한도가 있습니다 (인증 시 5,000회/시간). 기본 폴링
  주기(8초)에서는 여유가 충분하지만 폴링 주기를 너무 짧게 줄이면 한도에 걸릴 수
  있습니다.
- 이 도구는 Linux 샌드박스에서 작성·단위 테스트되었고, tkinter 렌더링은 Xvfb
  가상 디스플레이 + 가짜(mock) 데이터로 크래시 없이 동작하는 것까지 확인했습니다.
  실제 Windows 환경에서의 최종 동작 확인은 직접 실행해 확인해주세요.
