# Planner

## 목적

5년 라이프 로드맵을 4계층(Roadmap → Phase → Category → Item)으로 관리하고,
오늘 / 이번 주 / 이번 달 단위로 할 일을 도출한다.

Life Dashboard의 첫 번째 모듈이며, 이후 career·finance·health·growth 모듈의
체크리스트가 Planner의 Item으로 통합될 수 있는 기반이 된다.

## 사용자 시나리오

- 매일 "오늘 할 일"을 확인하고 체크한다
- Phase별 진행률을 확인한다
- 임박/지연 항목을 한눈에 파악한다
- 항목 완료 시 토글로 상태를 변경한다

## 기능 목록

### 조회

- 전체 로드맵 트리 (Roadmap → Phase → Category → Item)
- Phase 목록
- Item 목록 (필터: phase_id, status)
- 오늘 할 일 (deadline ≤ 오늘 + 7일, 미완료)
- 이번 주 할 일 (deadline ≤ 이번 주 일요일)
- 이번 달 할 일 (deadline ≤ 이번 달 말)

### 변경

- Item 완료 토글

## 데이터 모델 요약

4계층 구조. 상세는 [architecture/data-model.md](../architecture/data-model.md) 참조.

| 엔티티 | 역할 | 개수 |
|--------|------|------|
| Roadmap | 전체 계획 | 1 |
| Phase | 큰 단계 | 4 |
| Category | 영역 (Phase당) | 4 |
| Item | 체크리스트 항목 | N |

### 파생값

- `Phase.start_date` = `Roadmap.start_date + 이전 Phase들의 months 합`
- `Item.deadline` = `Phase.start_date + offset_months`
- `Item.status` = 완료 / 임박(≤30일) / 정상 / 지연

## 제외 범위 (V1)

- 사용자 정의 항목 추가/삭제 → V2
- 항목별 메모/첨부 → V2
- 알림/스케줄링 → V2
- 다중 Roadmap → V2

## 관련 문서

- [architecture/data-model.md](../architecture/data-model.md) (작성 예정)
- [api/planner.md](../api/planner.md) (작성 예정)