import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AppError } from '../types/database';
import type {
  BackgroundCheckCreated,
  BackgroundCheckList,
  BackgroundCheckRequest,
  BackgroundCheckResult,
} from '../types/database';

const API_BASE     = 'https://54capvm12g.execute-api.ap-northeast-2.amazonaws.com';
const POLL_INTERVAL_MS = 5_000; // pending 상태일 때 5초마다 재조회

// =============================================
// Zod 검증 스키마 — API 응답 런타임 검증
// =============================================
const CheckStatusSchema = z.enum(['pending', 'clear', 'flagged']);

const BackgroundCheckResultSchema = z.object({
  checkId:             z.string(),
  employeeId:          z.string(),
  firstName:           z.string(),
  lastName:            z.string(),
  dateOfBirth:         z.string(),
  status:              CheckStatusSchema,
  criminalRecord:      z.boolean().nullable(),
  educationVerified:   z.boolean().nullable(),
  employmentVerified:  z.boolean().nullable(),
  creditScore:         z.enum(['excellent', 'good', 'fair', 'poor']).nullable(),
  createdAt:           z.string(),
  completedAt:         z.string().nullable(),
});

const BackgroundCheckCreatedSchema = z.object({
  checkId:    z.string(),
  employeeId: z.string(),
  status:     CheckStatusSchema,
  createdAt:  z.string(),
  message:    z.string(),
});

// =============================================
// Fetch Utility — 공통 에러 처리
// =============================================

/**
 * 400: field-specific validation 에러 (message를 UI에 표시)
 * 503: retryAfter를 AppError에 포함 → UI 카운트다운 타이머에 전달
 * 5xx: 재시도 가능한 서버 에러
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await response.json();
  } catch {
    // JSON 파싱 실패 시 기본 메시지 사용
  }

  const message   = (body.message as string)   ?? response.statusText;
  const retryAfter = body.retryAfter as number | undefined;

  throw new AppError(message, response.status, retryAfter);
}

// =============================================
// Hook: 단건 조회 + pending 자동 폴링
//
// checkId가 null이면 비활성화.
// status가 'pending'이면 5초마다 재조회하고,
// 'clear' 또는 'flagged'가 되면 폴링을 자동으로 멈춘다.
// =============================================
export function useBackgroundCheckResult(checkId: string | null) {
  return useQuery({
    queryKey: ['background-check', checkId],
    queryFn:  async () => {
      const raw = await apiFetch<BackgroundCheckResult>(
        `${API_BASE}/background-checks/${checkId}`,
      );
      // 런타임 스키마 검증 — 외부 API 응답 이상 감지
      return BackgroundCheckResultSchema.parse(raw);
    },
    enabled: !!checkId,

    // pending 상태이면 5초마다 재조회, 완료되면 폴링 중단
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' ? POLL_INTERVAL_MS : false;
    },
    // 탭이 백그라운드일 때는 폴링 중지 (불필요한 네트워크 비용 절감)
    refetchIntervalInBackground: false,
  });
}

// =============================================
// Hook: 직원별 조회 이력 목록
// =============================================
export function useBackgroundCheckList(employeeId: string | null) {
  return useQuery({
    queryKey: ['background-checks', 'list', employeeId],
    queryFn:  () =>
      apiFetch<BackgroundCheckList>(
        `${API_BASE}/background-checks?employeeId=${encodeURIComponent(employeeId!)}`,
      ),
    enabled: !!employeeId,
    staleTime: 1000 * 30, // 30초 — 이력은 자주 바뀌지 않음
  });
}

// =============================================
// Hook: 배경 조회 요청 생성 (POST)
//
// onSuccess 시 해당 직원의 목록 캐시를 무효화해
// 목록이 자동으로 갱신되도록 한다.
// =============================================
export function useCreateBackgroundCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: BackgroundCheckRequest) =>
      apiFetch<BackgroundCheckCreated>(`${API_BASE}/background-checks`, {
        method: 'POST',
        body:   JSON.stringify(request),
      }).then((raw) => BackgroundCheckCreatedSchema.parse(raw)),

    onSuccess: (data, variables) => {
      // 목록 캐시 무효화 → 새 항목이 즉시 반영
      queryClient.invalidateQueries({
        queryKey: ['background-checks', 'list', variables.employeeId],
      });

      // pending으로 반환된 경우, 단건 조회 캐시를 미리 세팅해
      // useBackgroundCheckResult가 즉시 폴링을 시작할 수 있도록 함
      if (data.status === 'pending') {
        queryClient.setQueryData(
          ['background-check', data.checkId],
          {
            checkId:            data.checkId,
            employeeId:         data.employeeId,
            status:             'pending',
            firstName:          '',
            lastName:           '',
            dateOfBirth:        '',
            criminalRecord:     null,
            educationVerified:  null,
            employmentVerified: null,
            creditScore:        null,
            createdAt:          data.createdAt,
            completedAt:        null,
          } satisfies BackgroundCheckResult,
        );
      }
    },
  });
}
