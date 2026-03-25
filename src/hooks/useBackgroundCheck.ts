import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  createBackgroundCheck,
  getBackgroundCheck,
} from '../services/backgroundCheck';
import type {
  BackgroundCheckRequest,
  BackgroundCheckResult,
} from '../types/database';
import { AppError } from '../types/database';

// adminClient 의존성 완전 제거:
// background_checks INSERT/UPDATE는 일반 supabase 클라이언트로 수행.
// RLS 정책 "admins_all_background_checks" (get_my_role() = 'admin')가
// 관리자 세션(JWT)을 가진 요청만 허용하므로 보안 수준은 동일하다.

const POLL_INTERVAL_MS = 5_000;

// =============================================
// CreateCheckPayload — POST 요청 + Supabase 저장에 필요한 데이터
// profileId: Supabase profiles.id (UUID) — background_checks 테이블 FK
// =============================================
export type CreateCheckPayload = BackgroundCheckRequest & { profileId: string };

// =============================================
// Hook: 단건 조회 + pending 자동 폴링
// =============================================
export function useBackgroundCheckResult(checkId: string | null) {
  return useQuery({
    queryKey: ['background-check', checkId],
    queryFn:  () => getBackgroundCheck(checkId!),
    enabled:  !!checkId,
    retry:    false, // apiFetch가 500 재시도 처리, 503은 AppError로 즉시 throw
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status !== 'pending') return false;

      // 503 발생 시 retryAfter 만큼 대기 후 재시도
      const err = query.state.error;
      if (err instanceof AppError && err.statusCode === 503) {
        return (err.retryAfter ?? 30) * 1_000;
      }

      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });
}

// =============================================
// Hook: 직원별 조회 이력 목록 (Supabase에서 조회)
// =============================================
export function useBackgroundCheckList(employeeId: string | null) {
  return useQuery({
    queryKey: ['background-checks', 'list', employeeId],
    queryFn:  async (): Promise<import('../types/database').BackgroundCheckList> => {
      const { data, error } = await supabase
        .from('background_checks')
        .select('check_id, status, created_at, completed_at')
        .eq('employee_id', employeeId!)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return {
        employeeId: employeeId!,
        checks: (data ?? []).map((row) => ({
          checkId:     row.check_id,
          status:      row.status,
          createdAt:   row.created_at,
          completedAt: row.completed_at ?? null,
        })),
        totalCount: (data ?? []).length,
      };
    },
    enabled:   !!employeeId,
    staleTime: 1000 * 30,
    retry:     false,
  });
}

// =============================================
// Hook: 배경 조회 요청 생성 (POST)
//
// 1. 외부 API POST → checkId 발급
// 2. Supabase background_checks INSERT (pending 상태로 즉시 기록)
//    — supabase 클라이언트 사용 (RLS: 관리자 세션만 허용)
// =============================================
export function useCreateBackgroundCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, ...request }: CreateCheckPayload) => {
      // ── Step 1: 외부 API 호출 ───────────────────────────────────
      const created = await createBackgroundCheck(request);

      // ── Step 2: Supabase background_checks INSERT ───────────────
      const { error: dbError } = await supabase
        .from('background_checks')
        .insert({
          profile_id:          profileId,
          employee_id:         request.employeeId,
          check_id:            created.checkId,
          status:              created.status,
          criminal_record:     null,
          education_verified:  null,
          employment_verified: null,
          credit_score:        null,
        });

      if (dbError) {
        // INSERT 실패는 로그만 — 외부 API 호출은 성공했으므로 폴링은 계속 진행
        console.error('[useCreateBackgroundCheck] Supabase INSERT 실패:', dbError.message);
      }

      return created;
    },

    onSuccess: (data, { employeeId }) => {
      queryClient.invalidateQueries({
        queryKey: ['background-checks', 'list', employeeId],
      });
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

// =============================================
// Hook: 배경 조회 완료 시 Supabase UPDATE
// =============================================
export function useUpdateBackgroundCheckResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (result: BackgroundCheckResult) => {
      const { error } = await supabase
        .from('background_checks')
        .update({
          status:              result.status,
          criminal_record:     result.criminalRecord,
          education_verified:  result.educationVerified,
          employment_verified: result.employmentVerified,
          credit_score:        result.creditScore,
          completed_at:        result.completedAt,
        })
        .eq('check_id', result.checkId);

      if (error) {
        console.error('[useUpdateBackgroundCheckResult] Supabase UPDATE 실패:', error.message);
      }
    },
    onSuccess: (_, result) => {
      queryClient.invalidateQueries({
        queryKey: ['background-checks', 'list', result.employeeId],
      });
    },
  });
}
