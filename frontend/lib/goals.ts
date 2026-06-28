// 모듈 페이지에서 로컬 목표(localStorage)를 변경했을 때 같은 앱 내
// 대시보드 등이 즉시 다시 읽도록 알리는 경량 이벤트 헬퍼.
// (localStorage 값은 비밀이 아닌 사용자 설정값 — 토큰/시크릿은 다루지 않음)

export const GOAL_CHANGED_EVENT = 'local-goal-changed';

export function emitGoalChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(GOAL_CHANGED_EVENT));
  }
}
