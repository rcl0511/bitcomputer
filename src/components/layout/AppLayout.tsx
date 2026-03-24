import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  LogOut,
  ChevronRight,
  Shield,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { AppError } from '../../types/database';

interface AppLayoutProps {
  children: ReactNode;
}

// 사이드바 nav 링크 스타일
const sidebarLink = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
   ${isActive
     ? 'bg-white/20 text-white shadow-sm'
     : 'text-white/60 hover:bg-white/10 hover:text-white'
   }`;

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, isAdmin, signOut, realtimeAvailable, reconnectRealtime } = useAuth();
  const { error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // ── ④ Mutation 전역 에러 toast ────────────────────────────────────
  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      if (event.mutation.state.status !== 'error') return;
      const error = event.mutation.state.error;
      if (error instanceof AppError) {
        if (error.statusCode >= 500) {
          toastError(`서버 오류가 발생했습니다. (${error.statusCode})`);
        }
      } else if (error instanceof Error) {
        toastError('예기치 못한 오류가 발생했습니다.');
      }
    });
  }, [queryClient, toastError]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // 1. TanStack Query 캐시 전체 삭제 — 다음 사용자가 이전 데이터를 볼 수 없도록
      queryClient.clear();
      // 2. Supabase auth 토큰 외의 앱 전용 스토리지 항목 정리
      sessionStorage.clear();
      // (Supabase auth 토큰은 supabase.auth.signOut()이 직접 제거함)
      // 3. 세션 종료 및 /login 리다이렉트
      await signOut();
    } catch {
      toastError('로그아웃 중 오류가 발생했습니다.');
      setIsSigningOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <ConfirmDialog
        open={showLogoutConfirm}
        title="로그아웃"
        description={
          <>
            정말 로그아웃 하시겠습니까?<br />
            <span className="text-slate-500">현재 세션이 종료되고 로그인 페이지로 이동합니다.</span>
          </>
        }
        confirmLabel="로그아웃"
        isLoading={isSigningOut}
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="flex w-64 shrink-0 flex-col" style={{ backgroundColor: '#004192' }}>

        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <img src="/bit_logo.png" alt="비트컴퓨터" className="h-8 w-auto" />
          <div>
            <p className="text-sm font-bold text-white leading-none">비트컴퓨터</p>
            <p className="text-[10px] text-white/40 mt-0.5">인사관리 시스템</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
            메뉴
          </p>

          <NavLink to="/portal" className={sidebarLink}>
            {({ isActive }) => (
              <>
                <User className="h-4 w-4 shrink-0" />
                <span className="flex-1">내 프로필</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
              </>
            )}
          </NavLink>

          {isAdmin && (
            <>
              <p className="mt-4 mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                관리자
              </p>
              <NavLink to="/admin" className={sidebarLink} end>
                {({ isActive }) => (
                  <>
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span className="flex-1">직원 관리</span>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                  </>
                )}
              </NavLink>
            </>
          )}
        </nav>

        {/* 하단 영역 */}
        <div className="border-t border-white/10 p-3 space-y-2">
          {isAdmin && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2">
              <Shield className="h-3 w-3 text-white/60" />
              <span className="text-xs font-medium text-white/60">관리자 권한</span>
            </div>
          )}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-all active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-end border-b border-slate-200 bg-white px-8">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </header>

        {/* ── ⑤ Realtime 장애 배너 ─────────────────────────────── */}
        {!realtimeAvailable && (
          <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-8 py-2.5 text-sm shrink-0">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="flex-1 font-medium text-amber-800">
              실시간 연결이 끊어졌습니다. 퇴사 처리가 즉시 반영되지 않을 수 있습니다.
            </span>
            <button
              onClick={reconnectRealtime}
              className="flex items-center gap-1.5 font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              재연결
            </button>
          </div>
        )}

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
