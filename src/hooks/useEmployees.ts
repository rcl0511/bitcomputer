import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { adminClient } from '../lib/adminClient';
import type { Profile, UserRole, UserStatus } from '../types/database';

// =============================================
// 진단용 로그 태그
// =============================================
const TAG = '[useCreateEmployee]';

/**
 * 네트워크 요청에 타임아웃을 걸어 무한 대기를 방지한다.
 *
 * 무한 로딩의 1차 원인:
 * - adminClient.auth.admin.createUser는 SERVICE_ROLE_KEY가 없거나
 *   네트워크 이슈가 있을 때 Promise가 영원히 pending 상태로 남는다.
 * - fetch 자체는 reject하지 않고 그냥 기다리기 때문에
 *   try-catch도 finally도 실행되지 않는다.
 */
/**
 * PromiseLike<T>를 받도록 선언:
 * Supabase 쿼리 빌더(PostgrestFilterBuilder 등)는 .then()은 있지만
 * .catch() / .finally() / [Symbol.toStringTag]가 없어 Promise<T>에
 * 직접 대입할 수 없다. PromiseLike + Promise.resolve()로 감싸면 해결.
 */
function withTimeout<T>(thenable: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  return new Promise<T>((resolve, reject) => {
    timerId = setTimeout(() => {
      reject(
        new Error(
          `${label}: 요청 시간 초과 (${ms / 1000}초). ` +
          'VITE_SUPABASE_SERVICE_ROLE_KEY 설정과 네트워크 상태를 확인하세요.',
        ),
      );
    }, ms);

    Promise.resolve(thenable).then(
      (value) => { clearTimeout(timerId); resolve(value); },
      (err)   => { clearTimeout(timerId); reject(err);   },
    );
  });
}

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
// 사번(employee_id) 자동 생성
// Format: EMP-YYYY-XXX (해당 연도 순번, 3자리 zero-pad)
// =============================================
async function generateEmployeeId(): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `EMP-${year}-`;

  console.log(`${TAG} [generateEmployeeId] prefix="${prefix}" 조회 시작`);

  // adminClient 사용 이유: service role로 RLS 완전 우회.
  // supabase(anon) 클라이언트는 admins_select_all 정책의 get_my_role() 호출 중
  // hang이 발생할 수 있다.
  const { data, error } = await withTimeout(
    adminClient
      .from('profiles')
      .select('employee_id')
      .like('employee_id', `${prefix}%`)
      .order('employee_id', { ascending: false })
      .limit(1),
    8_000,
    'generateEmployeeId',
  );

  if (error) {
    console.error(`${TAG} [generateEmployeeId] DB 오류:`, error);
    throw new Error(`사번 생성 실패: ${error.message}`);
  }

  if (!data?.length) {
    const newId = `${prefix}001`;
    console.log(`${TAG} [generateEmployeeId] 첫 번째 직원 → ${newId}`);
    return newId;
  }

  // "EMP-2026-007" → slice(-3) → "007" → parseInt → 7 → 8 → "008"
  const lastNum = parseInt(data[0].employee_id.slice(-3), 10);

  if (isNaN(lastNum)) {
    console.error(`${TAG} [generateEmployeeId] 파싱 실패: "${data[0].employee_id}"`);
    throw new Error(`사번 파싱 실패: 기존 사번 형식(${data[0].employee_id})이 올바르지 않습니다.`);
  }

  const nextNum = String(lastNum + 1).padStart(3, '0');
  const newId   = `${prefix}${nextNum}`;
  console.log(`${TAG} [generateEmployeeId] 마지막 사번="${data[0].employee_id}" → 신규="${newId}"`);
  return newId;
}

// =============================================
// 신규 직원 등록
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

      // ── 사전 점검 ────────────────────────────────────────────────
      const serviceKeySet = !!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      console.log(`${TAG} 시작 — SERVICE_ROLE_KEY 설정됨: ${serviceKeySet}`);

      if (!serviceKeySet) {
        throw new Error(
          'VITE_SUPABASE_SERVICE_ROLE_KEY가 .env에 설정되지 않았습니다. ' +
          '관리자 계정 생성은 Service Role Key가 필요합니다.',
        );
      }

      // ── Step 1: Auth 유저 생성 ───────────────────────────────────
      console.log(`${TAG} Step 1: Auth 유저 생성 시작 (email=${payload.email})`);

      const { data: authData, error: authError } = await withTimeout(
        adminClient.auth.admin.createUser({
          email:         payload.email,
          password:      payload.password,
          email_confirm: true,
        }),
        12_000, // 12초 타임아웃
        'Step1 auth.admin.createUser',
      );

      if (authError) {
        console.error(`${TAG} Step 1 실패:`, authError);

        // 이미 존재하는 이메일
        if (authError.message.includes('already been registered') ||
            authError.message.includes('already registered')) {
          throw new Error(`이미 등록된 이메일입니다: ${payload.email}`);
        }
        throw new Error(`계정 생성 실패: ${authError.message}`);
      }

      console.log(`${TAG} Step 1 성공 — userId=${authData.user.id}`);

      // ── Step 2: 사번 자동 생성 ───────────────────────────────────
      console.log(`${TAG} Step 2: 사번 생성 시작`);

      let employeeId: string;
      try {
        employeeId = await generateEmployeeId();
      } catch (genErr) {
        console.error(`${TAG} Step 2 실패 — Auth 유저 롤백 시도:`, genErr);
        await adminClient.auth.admin.deleteUser(authData.user.id).catch((e) =>
          console.error(`${TAG} 롤백 실패 (Auth 유저 수동 삭제 필요: ${authData.user.id}):`, e),
        );
        throw genErr;
      }

      console.log(`${TAG} Step 2 성공 — 사번=${employeeId}`);

      // ── Step 3: profiles 레코드 INSERT ──────────────────────────
      // adminClient 사용 이유:
      //   supabase(anon) 클라이언트로 INSERT 시 admins_insert RLS 정책의
      //   get_my_status() / get_my_role() security-definer 함수 호출 중
      //   hang이 발생하는 것이 무한 로딩의 직접 원인.
      //   service role key는 RLS를 완전히 우회하므로 이 문제가 없다.
      console.log(`${TAG} Step 3: profiles INSERT 시작 (adminClient, id=${authData.user.id})`);

      const { data: profile, error: profileError } = await withTimeout(
        adminClient
          .from('profiles')
          .insert({
            id:          authData.user.id,
            employee_id: employeeId,
            full_name:   payload.full_name,
            dob:         payload.dob,
            role:        payload.role,
            status:      'active',
          })
          .select()
          .single(),
        12_000,
        'Step3 profiles INSERT',
      );

      if (profileError) {
        console.error(`${TAG} Step 3 실패 — code=${profileError.code}, msg=${profileError.message}`, profileError);

        // 사번 중복 (동시 생성 경합)
        if (profileError.code === '23505' && profileError.message.includes('employee_id')) {
          console.error(`${TAG} 사번 중복 (${employeeId}) — Auth 유저 롤백`);
          await adminClient.auth.admin.deleteUser(authData.user.id).catch((e) =>
            console.error(`${TAG} 롤백 실패:`, e),
          );
          throw new Error(
            `계정 생성은 되었으나 프로필 등록에 실패했습니다 — ` +
            `사번 중복(${employeeId}). 다시 시도해주세요.`,
          );
        }

        // Auth 유저 롤백 후 사용자 친화 메시지
        await adminClient.auth.admin.deleteUser(authData.user.id).catch((e) =>
          console.error(`${TAG} Auth 유저 롤백 실패 (수동 삭제 필요: ${authData.user.id}):`, e),
        );
        throw new Error(
          `계정 생성은 되었으나 프로필 등록에 실패했습니다 — ${profileError.message}`,
        );
      }

      console.log(`${TAG} Step 3 성공 — employee_id=${employeeId}`);
      return profile as Profile;
    },

    onSuccess: (profile) => {
      console.log(`${TAG} 완료 — ${profile.full_name} (${profile.employee_id})`);
      // 캐시 무효화: 목록 쿼리를 stale로 표시 → 다음 렌더에서 자동 재조회
      qc.invalidateQueries({ queryKey: ['employees'] });
      // 즉시 단건 캐시 세팅: 상세 페이지 이동 시 별도 fetch 없이 표시
      qc.setQueryData(['employee', profile.id], profile);
    },

    onError: (err) => {
      console.error(`${TAG} 최종 실패:`, err);
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
