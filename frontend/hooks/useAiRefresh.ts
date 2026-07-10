import { useEffect, useRef } from 'react';

/**
 * AI가 데이터를 저장하면 자동으로 refetch하는 훅.
 * modules: 감지할 모듈 prefix 목록. 빈 배열이면 모든 모듈에 반응.
 * debounceMs: 짧은 시간에 여러 ai-data-saved 이벤트(다중 저장)가 오면
 *   하나로 합쳐 refresh를 한 번만 호출한다. 기본 150ms.
 *
 * onRefresh가 Promise를 반환해도(비동기) 실패가 이벤트 핸들러 밖으로
 * 새어 나가지 않도록 내부에서 catch한다.
 */
export function useAiRefresh(
  modules: string[],
  onRefresh: () => void | Promise<void>,
  debounceMs = 150,
) {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    function runRefresh() {
      timer = null;
      try {
        const result = onRefreshRef.current();
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err: unknown) => {
            if (process.env.NODE_ENV !== 'production') {
              // 안전: 저장된 AI 데이터/페이로드는 로깅하지 않고 메시지만 출력
              console.warn(
                '[useAiRefresh] refresh failed:',
                err instanceof Error ? err.message : err,
              );
            }
          });
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[useAiRefresh] refresh failed:', err instanceof Error ? err.message : err);
        }
      }
    }

    function handler(e: Event) {
      const savedModule: string | null = (e as CustomEvent<{ module: string | null }>).detail
        .module;
      const matches = modules.length === 0 || modules.some((m) => savedModule?.startsWith(m));
      if (!matches) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(runRefresh, debounceMs);
    }

    window.addEventListener('ai-data-saved', handler);
    return () => {
      window.removeEventListener('ai-data-saved', handler);
      if (timer) clearTimeout(timer);
    };
  }, [modules.join(','), debounceMs]); // eslint-disable-line react-hooks/exhaustive-deps
}
