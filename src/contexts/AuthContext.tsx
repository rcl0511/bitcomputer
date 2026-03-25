import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

// =============================================
// Context Shape
// =============================================
interface AuthContextValue {
  session:            Session | null;
  profile:            Profile | null;
  isLoading:          boolean;
  // INITIAL_SESSION 처리가 완전히 끝났는지 여부
  // AuthGuard는 이 값이 true가 될 때까지 쿼리 실행을 막는다
  authReady:          boolean;
  isAuthenticated:    boolean;
  isAdmin:            boolean;
  signOut:            () => Promise<void>;
  // Realtime 상태 — WebSocket 불안정 시 UI 알림 + 수동 재연결에 사용
  realtimeAvailable:  boolean;
  reconnectRealtime:  () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================
// Realtime 재시도 설정
// Sydney 리전의 지연을 고려해 기본값보다 긴 백오프 사용
// =============================================
const REALTIME_MAX_RETRIES = 5;
const REALTIME_BACKOFF_MS  = [5_000, 10_000, 20_000, 30_000, 60_000];

// =============================================
// Provider
// =============================================
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  // localStorage에서 세션·프로필을 동기적으로 읽어 임시 초기화
  // ※ 이 값은 UI 깜빡임 방지용 임시 값일 뿐이며,
  //   최종 판단은 반드시 INITIAL_SESSION 이벤트 이후에 수행된다.
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
      );
      if (!key) return null;
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch { return null; }
  });

  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const cached = localStorage.getItem('iep_profile');
      return cached ? (JSON.parse(cached) as Profile) : null;
    } catch { return null; }
  });

  // session·profile 둘 다 캐시에 있으면 로딩 없이 즉시 렌더
  // ※ authReady가 INITIAL_SESSION 완료를 보장하므로 lazy initializer 유지
  const [isLoading, setLoading] = useState(() => {
    try {
      const hasSession = Object.keys(localStorage).some(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
      );
      const hasProfile = !!localStorage.getItem('iep_profile');
      return !(hasSession && hasProfile);
    } catch { return true; }
  });
  // INITIAL_SESSION 처리 완료 여부 — AuthGuard가 이 값을 보고 쿼리 실행 허용
  // lazy initializer가 isLoading=false로 시작해도 INITIAL_SESSION 전에 쿼리가
  // 실행되지 않도록 별도로 관리한다
  const [authReady, setAuthReady] = useState(false);
  const [realtimeAvailable, setRealtimeAvailable] = useState(true);

  // 프로필 캐시 동기화
  const setProfileAndCache = useCallback((prof: Profile | null) => {
    setProfile(prof);
    try {
      if (prof) localStorage.setItem('iep_profile', JSON.stringify(prof));
      else localStorage.removeItem('iep_profile');
    } catch { /* 스토리지 쓰기 실패 무시 */ }
  }, []);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 현재 구독 대상 userId를 ref로 보관 — reconnectRealtime()에서 사용
  const currentUserIdRef   = useRef<string | null>(null);

  // ── 퇴사 처리 ───────────────────────────────────────────────────────
  // supabase.auth.signOut()이 sb-*-auth-token 키를 정리하고,
  // iep_profile은 아래에서 명시적으로 제거한다.
  const handleResigned = useCallback(async () => {
    try { localStorage.removeItem('iep_profile'); } catch { /* 무시 */ }
    await supabase.auth.signOut();
    navigate('/login', { replace: true, state: { accessDenied: true } });
  }, [navigate]);

  // ── 프로필 단건 조회 ──────────────────────────────────────────────
  // PGRST116 = "no rows returned" → null 반환 (프로필 미존재 → 정상 퇴사 처리 흐름)
  // 그 외 오류 = DB 다운 / 네트워크 문제 → throw (로그아웃 처리 금지)
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // 프로필 행 없음
      console.warn('[AuthProvider] fetchProfile DB 오류 — 로그아웃 생략:', error.code, error.message);
      throw error; // DB 다운 등 일시적 오류 → 호출부에서 처리
    }
    return data as Profile;
  }, []);

  // ── Realtime 구독 ────────────────────────────────────────────────
  const subscribeToProfileStatus = useCallback(
    (userId: string, retryCount = 0) => {
      // 진행 중인 재시도 타이머 취소
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      // 기존 채널 정리
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }

      currentUserIdRef.current = userId;

      const channel = supabase
        .channel(`profile-status:${userId}:${retryCount}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          async (payload) => {
            const updated = payload.new as Profile;
            if (updated.status === 'resigned') {
              await handleResigned();
              return;
            }
            setProfileAndCache(updated);
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // 연결 성공 — 이전에 unavailable 상태였다면 복구
            setRealtimeAvailable(true);
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (retryCount < REALTIME_MAX_RETRIES) {
              const delay = REALTIME_BACKOFF_MS[retryCount] ?? 60_000;
              console.warn(
                `[AuthProvider] Realtime ${status} — ` +
                `${delay / 1000}초 후 재시도 (${retryCount + 1}/${REALTIME_MAX_RETRIES})`,
              );
              retryTimerRef.current = setTimeout(() => {
                if (currentUserIdRef.current) {
                  subscribeToProfileStatus(currentUserIdRef.current, retryCount + 1);
                }
              }, delay);
            } else {
              // 최대 재시도 초과 → UI에 상태 노출
              console.error(
                '[AuthProvider] Realtime 재연결 한도 초과 — ' +
                '퇴사 즉시 차단이 비활성화됩니다.',
              );
              setRealtimeAvailable(false);
            }
          }
        });

      realtimeChannelRef.current = channel;
    },
    [handleResigned, setProfileAndCache],
  );

  // 수동 재연결 — realtimeAvailable === false 시 UI에서 호출
  const reconnectRealtime = useCallback(() => {
    if (currentUserIdRef.current) {
      setRealtimeAvailable(true); // 낙관적 업데이트 (재시도 시작 즉시)
      subscribeToProfileStatus(currentUserIdRef.current, 0);
    }
  }, [subscribeToProfileStatus]);

  // ── Auth 상태 초기화 ────────────────────────────────────────────
  // INITIAL_SESSION: SDK가 localStorage에서 세션을 검증한 후 최초 1회 발생
  //   → 이 이벤트 이후에만 isLoading = false 처리 (세션 유효성 보장)
  useEffect(() => {
    let mounted = true;

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // ── 초기 세션 복원 (새로고침 시 항상 먼저 발생) ──────────────
        if (event === 'INITIAL_SESSION') {
          if (!newSession) {
            // 세션 없음 — 만료·무효 토큰일 수 있으므로 오염된 캐시 전부 제거
            setSession(null);
            setProfileAndCache(null);
            try {
              const staleKey = Object.keys(localStorage).find(
                (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
              );
              if (staleKey) localStorage.removeItem(staleKey);
            } catch { /* 무시 */ }
            setLoading(false);
            setAuthReady(true);
            return;
          }

          setSession(newSession);

          // 프로필 fetch — 완료 후 isLoading 해제 (검증 전에 화면을 열지 않음)
          let prof: Profile | null;
          try {
            prof = await fetchProfile(newSession.user.id);
          } catch {
            // DB 다운 등 일시적 오류 — 세션 유지, 로그아웃 금지
            // iep_profile 캐시는 삭제: 프로필 fetch 실패 상태에서 stale 캐시가 남으면
            // 다음 새로고침 때 lazy initializer가 오염된 값을 읽는다
            if (mounted) {
              try { localStorage.removeItem('iep_profile'); } catch { /* 무시 */ }
              setLoading(false);
              setAuthReady(true);
            }
            return;
          }
          if (!mounted) return;

          if (!prof || prof.status === 'resigned') {
            await handleResigned();
            return;
          }

          setProfileAndCache(prof);
          subscribeToProfileStatus(newSession.user.id);
          setLoading(false);
          setAuthReady(true);
          return;
        }

        // ── 신규 로그인 ───────────────────────────────────────────────
        if (event === 'SIGNED_IN') {
          if (!newSession) return;

          let prof: Profile | null;
          try {
            prof = await fetchProfile(newSession.user.id);
          } catch {
            // DB 다운 등 일시적 오류 — 세션·프로필 초기화 후 로그인 화면으로
            if (mounted) {
              setSession(null);
              setProfileAndCache(null);
              setLoading(false);
            }
            return;
          }
          if (!mounted) return;

          if (!prof || prof.status === 'resigned') {
            await handleResigned();
            return;
          }

          setSession(newSession);
          setProfileAndCache(prof);
          setLoading(false);
          setAuthReady(true);
          subscribeToProfileStatus(newSession.user.id);
          return;
        }

        // ── 토큰 갱신 ─────────────────────────────────────────────────
        if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
          return;
        }

        // ── 로그아웃 ──────────────────────────────────────────────────
        if (event === 'SIGNED_OUT' || !newSession) {
          setSession(null);
          setProfileAndCache(null);
          setLoading(false);
          currentUserIdRef.current = null;
          if (retryTimerRef.current)      { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
          if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
        }
      },
    );

    return () => {
      mounted = false;
      authSub.unsubscribe();
      if (retryTimerRef.current)      clearTimeout(retryTimerRef.current);
      if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
    };
  }, [fetchProfile, handleResigned, subscribeToProfileStatus]);

  // ── 수동 로그아웃 ───────────────────────────────────────────────
  // iep_profile을 먼저 제거 후 signOut — SIGNED_OUT 이벤트에서도 정리되지만 명시적으로 선행 처리
  const signOut = useCallback(async () => {
    try { localStorage.removeItem('iep_profile'); } catch { /* 무시 */ }
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{
      session,
      profile,
      isLoading,
      authReady,
      isAuthenticated:   !!session,
      isAdmin:           profile?.role === 'admin',
      signOut,
      realtimeAvailable,
      reconnectRealtime,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================
// useAuth
// =============================================
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
