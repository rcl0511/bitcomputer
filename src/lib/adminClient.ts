/**
 * ⚠️  DEPRECATED — 이 클라이언트는 더 이상 직접 사용하지 않는다.
 *
 * 마이그레이션 완료:
 *   - 직원 생성(Auth user + profile INSERT)
 *     → Supabase Edge Function `create-employee`로 이전
 *   - background_checks INSERT/UPDATE
 *     → 일반 `supabase` 클라이언트(RLS: get_my_role() = 'admin')로 교체
 *
 * 이 파일을 남겨두는 이유:
 *   향후 VITE_SUPABASE_SERVICE_ROLE_KEY가 다시 필요한 경우를 대비한 참조용.
 *   VITE_SUPABASE_SERVICE_ROLE_KEY가 .env에 없어도 앱이 크래시되지 않도록
 *   방어적으로 초기화한다.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL             as string;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined;

if (serviceRoleKey) {
  console.info('[adminClient] Service Role Key 감지됨 — 필요 시 사용 가능');
} else {
  console.info('[adminClient] VITE_SUPABASE_SERVICE_ROLE_KEY 미설정 — Edge Function 모드로 동작');
}

// serviceRoleKey가 없을 때 빈 문자열 대신 'MISSING'을 사용:
// createClient는 falsy 값(빈 문자열)에서 즉시 throw하지만,
// truthy 문자열이면 클라이언트 인스턴스를 생성하고 실제 요청 시에만 401을 반환한다.
// 앱 부팅 시 크래시를 막기 위한 방어 처리.
export const adminClient = createClient(
  supabaseUrl,
  serviceRoleKey ?? 'MISSING_SERVICE_ROLE_KEY',
  {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
      storageKey:       'sb-admin-service-role',
    },
  },
);
