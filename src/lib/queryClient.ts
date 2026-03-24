import { QueryClient } from '@tanstack/react-query';
import { AppError } from '../types/database';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx: 재시도 불필요, 5xx: 최대 2회 재시도
      retry: (failureCount, error) => {
        if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 1000 * 60, // 1분
    },
    mutations: {
      // 5xx 에러는 전역 핸들러에서 Toast 처리 (Phase 4에서 연결)
      onError: (error) => {
        if (error instanceof AppError && error.statusCode >= 500) {
          console.error('[QueryClient] Server error:', error.message);
        }
      },
    },
  },
});
