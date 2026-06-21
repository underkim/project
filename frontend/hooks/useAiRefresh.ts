import { useEffect, useRef } from 'react';

/**
 * AI가 데이터를 저장하면 자동으로 refetch하는 훅.
 * modules: 감지할 모듈 prefix 목록. 빈 배열이면 모든 모듈에 반응.
 */
export function useAiRefresh(modules: string[], onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    function handler(e: Event) {
      const savedModule: string | null = (e as CustomEvent<{ module: string | null }>).detail.module;
      const matches =
        modules.length === 0 ||
        modules.some(m => savedModule?.startsWith(m));
      if (matches) onRefreshRef.current();
    }
    window.addEventListener('ai-data-saved', handler);
    return () => window.removeEventListener('ai-data-saved', handler);
  }, [modules.join(',')]);  // eslint-disable-line react-hooks/exhaustive-deps
}
