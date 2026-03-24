import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:   true,   // 탭을 닫아도 세션 유지 (localStorage)
    autoRefreshToken: true,   // Realtime과 세션 갱신 충돌 방지
  },
  realtime: {
    params: { eventsPerSecond: 10 },

    // ── WebSocket 안정성 설정 (Sydney 리전 지연 대응) ──────────────
    // 기본 타임아웃(10s)보다 여유 있게 — 첫 연결 실패를 줄인다
    timeout: 20_000,

    // heartbeat 주기 — 무응답 연결을 조기에 감지해 재연결 유도
    heartbeatIntervalMs: 30_000,

    // 재연결 백오프: 1s → 2s → 4s → ... → 최대 30s
    // 기본 선형 증가 대신 지수 백오프로 서버 부하 분산
    reconnectAfterMs: (tries: number) =>
      Math.min(1_000 * Math.pow(2, tries - 1), 30_000),
  },
});
