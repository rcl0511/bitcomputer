import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole, UserStatus } from '../types/database';

// =============================================
// 직원 목록 조회 (Admin)
// =============================================
interface EmployeeFilters {
  search?: string;
  status?: UserStatus | 'all';
}

export function useEmployees(filters: EmployeeFilters = {}) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.search?.trim()) {
        const q = filters.search.trim();
        query = query.or(`full_name.ilike.%${q}%,employee_id.ilike.%${q}%`);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Profile[];
    },
  });
}

/**
 * profileId로 단일 직원 프로필 조회 (Admin: 상세 페이지용)
 */
export function useEmployee(profileId: string | undefined) {
  return useQuery({
    queryKey: ['employee', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!profileId,
  });
}

// =============================================
// 신규 직원 등록 — Edge Function 호출
//
// 보안 변경:
//   이전: 프론트엔드에서 adminClient(SERVICE_ROLE_KEY)로 직접 Auth 유저 생성
//   현재: supabase.functions.invoke('create-employee')로 Edge Function 호출
//         SERVICE_ROLE_KEY는 서버(Edge Function) 환경변수에서만 사용
// =============================================
export interface CreateEmployeePayload {
  email:     string;
  password:  string;
  full_name: string;
  dob:       string;   // YYYY-MM-DD
  role:      UserRole;
}

export function useCreateEmployee() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateEmployeePayload) => {
      const { data, error } = await supabase.functions.invoke<Profile>('create-employee', {
        body: payload,
      });

      if (error) {
        // FunctionsHttpError: Edge Function이 4xx/5xx를 반환한 경우
        // error.context.json()으로 바디를 파싱해 사용자 친화적 메시지 추출
        if ('context' in error) {
          try {
            const body = await (error as unknown as { context: Response }).context.json();
            throw new Error(body?.error ?? error.message);
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr;
          }
        }
        throw new Error(error.message);
      }

      if (!data) throw new Error('직원 등록 응답이 비어있습니다.');
      return data;
    },

    onSuccess: (profile) => {
      // 목록 캐시 무효화 + 단건 캐시 즉시 세팅
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.setQueryData(['employee', profile.id], profile);
    },

    onError: (err) => {
      console.error('[useCreateEmployee] 실패:', err);
    },
  });
}

// =============================================
// 퇴사 처리 — status를 'resigned'로 변경
// =============================================
export function useTerminateEmployee() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (profileId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ status: 'resigned' })
        .eq('id', profileId)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.setQueryData(['employee', updated.id], updated);
    },
  });
}
