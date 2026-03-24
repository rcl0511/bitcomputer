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
  session:         Session | null;
  profile:         Profile | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  isAdmin:         boolean;
  signOut:         () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================
// Provider
// Realtime 구독과 Auth 상태 관리는 여기서 단 1회 초기화된다.
// 여러 Guard 컴포넌트가 useAuth()를 호출해도 구독이 중복 생성되지 않는다.
// =============================================
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [session, setSession]   = useState<Session | null>(null);
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [isLoading, setLoading] = useState(true);

  // Realtime 채널을 ref로 관리 — 구독 대상 userId가 바뀔 때만 재생성
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── 퇴사 처리: 즉시 signOut 후 /login으로 이동 ──────────────────────
  const handleResigned = useCallback(async () => {
    await supabase.auth.signOut();
    // session/profile은 onAuthStateChange SIGNED_OUT 이벤트에서 초기화됨
    navigate('/login', {
      replace: true,
      state: { accessDenied: true },
    });
  }, [navigate]);

  // ── 프로필 단건 조회 ─────────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // RLS에 의해 차단된 경우(resigned 등) PGRST116 에러 반환
      console.warn('[AuthProvider] fetchProfile error:', error.code, error.message);
      return null;
    }
    return data as Profile;
  }, []);

  // ── Realtime 구독: profiles 테이블의 UPDATE 이벤트 감시 ──────────────
  //
  // 관리자가 status를 'resigned'로 변경하는 순간, Supabase가 WebSocket으로
  // payload를 전송하고 handleResigned()가 즉시 실행된다.
  const subscribeToProfileStatus = useCallback(
    (userId: string) => {
      // 기존 채널이 있으면 정리 후 재생성
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }

      const channel = supabase
        .channel(`profile-status:${userId}`)
        .on(
          'postgres_changes',
          {
            event:  'UPDATE',
            schema: 'public',
            table:  'profiles',
            filter: `id=eq.${userId}`,
          },
          async (payload) => {
            const updated = payload.new as Profile;

            if (updated.status === 'resigned') {
              // 관리자가 "퇴사" 버튼을 누른 순간 — 즉시 세션 만료
              await handleResigned();
              return;
            }

            // 그 외 프로필 변경(이름, 역할 등) 반영
            setProfile(updated);
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('[AuthProvider] Realtime channel error — status watch unavailable');
          }
        });

      realtimeChannelRef.current = channel;
    },
    [handleResigned],
  );

  // ── Auth 상태 초기화 및 onAuthStateChange 구독 ────────────────────────
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

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

    // Auth 이벤트(로그인/로그아웃/토큰 갱신) 감지
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !newSession) {
        setSession(null);
        setProfile(null);
        setLoading(false);
        if (realtimeChannelRef.current) {
          supabase.removeChannel(realtimeChannelRef.current);
          realtimeChannelRef.current = null;
        }
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
    });

    return () => {
      mounted = false;
      authSub.unsubscribe();
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [fetchProfile, handleResigned, subscribeToProfileStatus]);

  // ── 수동 로그아웃 ────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }, [navigate]);

  const value: AuthContextValue = {
    session,
    profile,
    isLoading,
    isAuthenticated: !!session,
    isAdmin:         profile?.role === 'admin',
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================
// useAuth — Context 소비 훅
// AuthProvider 외부에서 사용 시 명확한 에러 메시지 제공
// =============================================
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
