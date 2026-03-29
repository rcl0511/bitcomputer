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

  // persistSession: false — SDK가 메모리에서만 세션을 관리하므로
  // localStorage 동기 초기화가 불필요해졌다.
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // 캐시가 있어도 만료 상태일 수 있으므로 항상 true로 시작
  // INITIAL_SESSION 완료 후에만 false로 전환 → AuthGuard가 검증 전 렌더 차단
  // (session·profile 동기 초기화는 유지 — 전환 시 깜빡임 방지용 임시값)
  const [isLoading, setLoading] = useState(true);
  // INITIAL_SESSION 처리 완료 여부 — AuthGuard가 이 값을 보고 쿼리 실행 허용
  // lazy initializer가 isLoading=false로 시작해도 INITIAL_SESSION 전에 쿼리가
  // 실행되지 않도록 별도로 관리한다
  const [authReady, setAuthReady] = useState(false);
  const [realtimeAvailable, setRealtimeAvailable] = useState(true);

  const setProfileAndCache = useCallback((prof: Profile | null) => {
    setProfile(prof);
  }, []);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 현재 구독 대상 userId를 ref로 보관 — reconnectRealtime()에서 사용
  const currentUserIdRef   = useRef<string | null>(null);

  // ── 퇴사 처리 ───────────────────────────────────────────────────────
  // supabase.auth.signOut()이 sb-*-auth-token 키를 정리하고,
  // iep_profile은 아래에서 명시적으로 제거한다.
  const handleResigned = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true, state: { accessDenied: true } });
  }, [navigate]);

  // ── 프로필 단건 조회 ──────────────────────────────────────────────
  // PGRST116 = "no rows returned" → null 반환 (프로필 미존재 → 정상 퇴사 처리 흐름)
  // 그 외 오류 = DB 다운 / 네트워크 문제 → throw (로그아웃 처리 금지)
  // 10초 타임아웃: 응답 없이 무한 대기하면 catch로 빠져 로딩 해제
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const query = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('fetchProfile timeout')), 10_000),
    );

    const { data, error } = await Promise.race([query, timeout]);

    if (error) {
      if (error.code === 'PGRST116') return null; // 프로필 행 없음
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
              retryTimerRef.current = setTimeout(() => {
                if (currentUserIdRef.current) {
                  subscribeToProfileStatus(currentUserIdRef.current, retryCount + 1);
                }
              }, delay);
            } else {
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

  // ── 콜백 refs — useEffect dep [] 유지를 위해 최신 함수를 ref에 동기화 ──
  const fetchProfileRef           = useRef(fetchProfile);
  const handleResignedRef         = useRef(handleResigned);
  const setProfileAndCacheRef     = useRef(setProfileAndCache);
  const subscribeToProfileStatusRef = useRef(subscribeToProfileStatus);
  useEffect(() => {
    fetchProfileRef.current             = fetchProfile;
    handleResignedRef.current           = handleResigned;
    setProfileAndCacheRef.current       = setProfileAndCache;
    subscribeToProfileStatusRef.current = subscribeToProfileStatus;
  });

  // ── Auth 상태 초기화 ────────────────────────────────────────────
  // INITIAL_SESSION: SDK가 메모리에서 세션을 확인한 후 최초 1회 발생
  //   → 이 이벤트 이후에만 isLoading = false 처리 (세션 유효성 보장)
  useEffect(() => {
    let mounted = true;

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // ── 초기 세션 복원 (새로고침 시 항상 먼저 발생) ──────────────
        if (event === 'INITIAL_SESSION') {
          if (!newSession) {
            // 세션 없음 → 로딩 해제
            setSession(null);
            setProfileAndCacheRef.current(null);
            setLoading(false);
            setAuthReady(true);
            return;
          }

          setSession(newSession);

          let prof: Profile | null;
          try {
            prof = await fetchProfileRef.current(newSession.user.id);
          } catch {
            if (mounted) {
              setLoading(false);
              setAuthReady(true);
            }
            return;
          }
          if (!mounted) return;

          if (!prof || prof.status === 'resigned') {
            await handleResignedRef.current();
            return;
          }

          setProfileAndCacheRef.current(prof);
          subscribeToProfileStatusRef.current(newSession.user.id);
          setLoading(false);
          setAuthReady(true);
          return;
        }

        // ── 신규 로그인 / INITIAL_SESSION 미지원 버전의 초기 세션 복원 ────
        if (event === 'SIGNED_IN') {
          if (!newSession) return;

          let prof: Profile | null;
          try {
            prof = await fetchProfileRef.current(newSession.user.id);
          } catch {
            // DB 다운 / 타임아웃 등 일시적 오류 — 세션은 유지, 로그아웃 금지
            if (mounted) {
              setSession(newSession);
              setLoading(false);
              setAuthReady(true);
            }
            return;
          }
          if (!mounted) return;

          if (!prof || prof.status === 'resigned') {
            await handleResignedRef.current();
            return;
          }

          setSession(newSession);
          setProfileAndCacheRef.current(prof);
          setLoading(false);
          setAuthReady(true);
          subscribeToProfileStatusRef.current(newSession.user.id);
          return;
        }

        // ── 토큰 갱신 ─────────────────────────────────────────────────
        if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
          return;
        }

        // ── 이메일 변경 확인 완료 ────────────────────────────────────
        // 확인 링크가 새 탭에서 열려 Web Lock을 가로채므로 기존 탭에서
        // 락 오류가 발생한다. 이메일이 바뀌었으면 로그아웃 후 재로그인 유도.
        if (event === 'USER_UPDATED' && newSession) {
          const prevEmail = session?.user?.email;
          const nextEmail = newSession.user.email;
          if (prevEmail && nextEmail && prevEmail !== nextEmail) {
            // 이메일 변경 — 재인증 필요
            await supabase.auth.signOut();
            navigate('/login', {
              replace: true,
              state: { emailChanged: true, newEmail: nextEmail },
            });
            return;
          }
          setSession(newSession);
          return;
        }

        // ── 로그아웃 ──────────────────────────────────────────────────
        if (event === 'SIGNED_OUT' || !newSession) {
          setSession(null);
          setProfileAndCache(null);
          setLoading(false);
          setAuthReady(true);
          currentUserIdRef.current = null;
          if (retryTimerRef.current)      { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
          if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
        }
      },
    );

    // ── INITIAL_SESSION 미지원 버전 폴백 ───────────────────────────
    // 이 Supabase 버전은 INITIAL_SESSION을 발생시키지 않음.
    // 세션이 없으면 SIGNED_IN도 오지 않아 isLoading이 영원히 true로 남는 문제를
    // getSession()으로 직접 확인해 해소한다.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        setSession(null);
        setProfileAndCache(null);
        setLoading(false);
        setAuthReady(true);
      }
    });

    return () => {
      mounted = false;
      authSub.unsubscribe();
      if (retryTimerRef.current)      clearTimeout(retryTimerRef.current);
      if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
    };
  }, []);

  // ── 수동 로그아웃 ───────────────────────────────────────────────
  const signOut = useCallback(async () => {
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
