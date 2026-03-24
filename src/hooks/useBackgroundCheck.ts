import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminClient } from '../lib/adminClient';
import {
  createBackgroundCheck,
  getBackgroundCheck,
  listBackgroundChecks,
} from '../services/backgroundCheck';
import type {
  BackgroundCheckRequest,
  BackgroundCheckResult,
} from '../types/database';

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
// =============================================
export function useCreateBackgroundCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, ...request }: CreateCheckPayload) => {
      // ── Step 1: 외부 API 호출 ───────────────────────────────────
      const created = await createBackgroundCheck(request);

      // ── Step 2: Supabase background_checks INSERT ───────────────
      // service role(adminClient)로 RLS 우회하여 바로 저장
      const { error: dbError } = await adminClient
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
          // created_at: DB default, completed_at: null until done
        });

      if (dbError) {
        // 저장 실패는 로그만 남기고 throw하지 않음
        // — 외부 API 호출은 성공했으므로 폴링은 계속 진행
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
//
// 외부 API 폴링으로 clear/flagged가 확인되면
// Supabase background_checks 레코드를 최종 결과로 갱신한다.
// =============================================
export function useUpdateBackgroundCheckResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (result: BackgroundCheckResult) => {
      const { error } = await adminClient
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
        // 업데이트 실패는 로그만 — UI 표시는 외부 API 응답 기준으로 유지
        console.error('[useUpdateBackgroundCheckResult] Supabase UPDATE 실패:', error.message);
      }
    },
    onSuccess: (_, result) => {
      // 목록 캐시 갱신 → 이력 패널에 최신 상태 반영
      queryClient.invalidateQueries({
        queryKey: ['background-checks', 'list', result.employeeId],
      });
    },
  });
}
