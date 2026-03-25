import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole, UserStatus, Department, Position } from '../types/database';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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
  email:      string;
  password:   string;
  full_name:  string;
  dob:        string;   // YYYY-MM-DD
  role:       UserRole;
  department: Department | null;
  position:   Position   | null;
}

export function useCreateEmployee() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateEmployeePayload) => {
      const { department, position, ...edgePayload } = payload;

      // refreshSession()으로 항상 최신 access_token 확보
      const { data: refreshData } = await supabase.auth.refreshSession();
      const accessToken = refreshData.session?.access_token;
      if (!accessToken) throw new Error('로그인 세션이 만료됐습니다. 다시 로그인해주세요.');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ...edgePayload, department, position }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? body?.message ?? `서버 오류 (${res.status})`);
      }

      const data: Profile | null = await res.json().catch(() => null);
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
// 직원 프로필 수정 (Admin)
// =============================================
export interface UpdateEmployeePayload {
  full_name:  string;
  dob:        string;
  department: Department | null;
  position:   Position   | null;
  role:       UserRole;
  status:     UserStatus;
}

export function useUpdateEmployee() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, payload }: { profileId: string; payload: UpdateEmployeePayload }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
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

// =============================================
// 임시 비밀번호 발급 — Edge Function 호출
// =============================================
export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data: refreshData } = await supabase.auth.refreshSession();
      const accessToken = refreshData.session?.access_token;
      if (!accessToken) throw new Error('로그인 세션이 만료됐습니다. 다시 로그인해주세요.');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `서버 오류 (${res.status})`);
      }
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
