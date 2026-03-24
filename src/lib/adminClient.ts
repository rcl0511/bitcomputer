/**
 * ⚠️  Service Role Client — 관리자 전용 Auth 작업에만 사용
 *
 * Service Role Key는 RLS를 완전히 우회한다.
 * - 사용 목적: 신규 직원 계정 생성 (`auth.admin.createUser`)
 * - 이 클라이언트를 일반 데이터 조회에 사용하지 말 것
 *
 * 프로덕션 권장 사항:
 * - 이 로직을 Supabase Edge Function으로 이전하고
 *   service role key를 서버 환경변수에서만 관리할 것.
 * - 현재 구현은 내부 관리자 도구(Internal Admin Tool)로 제한된 환경을 전제로 한다.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = import.meta.env.VITE_SUPABASE_URL             as string;
const serviceRoleKey     = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string;

if (!serviceRoleKey) {
  console.warn('[adminClient] VITE_SUPABASE_SERVICE_ROLE_KEY is not set. Employee creation will fail.');
}

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    // 관리자 클라이언트는 세션을 유지하지 않는다.
    persistSession:   false,
    autoRefreshToken: false,
    // supabase.ts의 기본 storageKey('sb-<ref>-auth-token')와 충돌을 막기 위해
    // 고유한 키를 지정한다. 이것이 "Multiple GoTrueClient instances" 경고의 원인.
    storageKey: 'sb-admin-service-role',
  },
});
