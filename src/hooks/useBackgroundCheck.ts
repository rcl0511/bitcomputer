import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  createBackgroundCheck,
  getBackgroundCheck,
  listBackgroundChecks,
} from '../services/backgroundCheck';
import type {
  BackgroundCheckRequest,
  BackgroundCheckResult,
} from '../types/database';

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
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' ? POLL_INTERVAL_MS : false;
    },
    refetchIntervalInBackground: false,
  });
}

// =============================================
// Hook: 직원별 조회 이력 목록
// =============================================
export function useBackgroundCheckList(employeeId: string | null) {
  return useQuery({
    queryKey: ['background-checks', 'list', employeeId],
    queryFn:  () => listBackgroundChecks(employeeId!),
    enabled:  !!employeeId,
    staleTime: 1000 * 30,
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
