import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 탭을 닫아도 세션 유지 (localStorage 기반)
    persistSession: true,
    // status 변경 감지를 위한 Realtime이 세션 갱신과 충돌하지 않도록 자동 갱신 활성화
    autoRefreshToken: true,
  },
  realtime: {
    // 명시적으로 WebSocket 설정 (네트워크 불안정 시 재연결)
    params: { eventsPerSecond: 10 },
  },
});
