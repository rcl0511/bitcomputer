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

  const [session,           setSession]           = useState<Session | null>(null);
  const [profile,           setProfile]           = useState<Profile | null>(null);
  const [isLoading,         setLoading]           = useState(true);
  const [realtimeAvailable, setRealtimeAvailable] = useState(true);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 현재 구독 대상 userId를 ref로 보관 — reconnectRealtime()에서 사용
  const currentUserIdRef   = useRef<string | null>(null);

  // ── 퇴사 처리 ───────────────────────────────────────────────────────
  const handleResigned = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true, state: { accessDenied: true } });
  }, [navigate]);

  // ── 프로필 단건 조회 ──────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[AuthProvider] fetchProfile error:', error.code, error.message);
      return null;
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
            setProfile(updated);
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
    [handleResigned],
  );

  // 수동 재연결 — realtimeAvailable === false 시 UI에서 호출
  const reconnectRealtime = useCallback(() => {
    if (currentUserIdRef.current) {
      setRealtimeAvailable(true); // 낙관적 업데이트 (재시도 시작 즉시)
      subscribeToProfileStatus(currentUserIdRef.current, 0);
    }
  }, [subscribeToProfileStatus]);

  // ── Auth 상태 초기화 ────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!initialSession) {
        setLoading(false);
        return;
      }

      const prof = await fetchProfile(initialSession.user.id);
      if (!mounted) return;

      if (!prof || prof.status === 'resigned') {
        await handleResigned();
        return;
      }

      setSession(initialSession);
      setProfile(prof);
      setLoading(false);
      subscribeToProfileStatus(initialSession.user.id);
    };

    initAuth();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !newSession) {
          setSession(null);
          setProfile(null);
          setLoading(false);
          currentUserIdRef.current = null;
          if (retryTimerRef.current)      { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
          if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const prof = await fetchProfile(newSession.user.id);
          if (!mounted) return;

          if (!prof || prof.status === 'resigned') {
            await handleResigned();
            return;
          }

          setSession(newSession);
          setProfile(prof);
          setLoading(false);
          subscribeToProfileStatus(newSession.user.id);
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
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{
      session,
      profile,
      isLoading,
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
