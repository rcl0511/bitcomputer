import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Building2,
  LayoutDashboard,
  User,
  LogOut,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface AppLayoutProps {
  children: ReactNode;
}

// 사이드바 nav 링크 스타일
const sidebarLink = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
   ${isActive
     ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30'
     : 'text-slate-400 hover:bg-slate-800 hover:text-white'
   }`;

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, isAdmin, signOut } = useAuth();
  const { error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';

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
      <aside className="flex w-64 shrink-0 flex-col bg-slate-900">

        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-900/40">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">IEP</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Employee Portal</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
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
              <p className="mt-4 mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
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

        {/* User Card + Logout */}
        <div className="border-t border-slate-800 p-3 space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-3">
            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{profile?.full_name}</p>
              <p className="truncate text-xs text-slate-400">{profile?.employee_id}</p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600/10 px-3 py-1.5">
              <Shield className="h-3 w-3 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-400">관리자 권한</span>
            </div>
          )}

          {/* 로그아웃 버튼 */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5
              text-sm font-medium text-slate-400 transition-colors
              hover:bg-red-500/10 hover:text-red-400 active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center border-b border-slate-200 bg-white px-8">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="font-medium text-slate-800">{profile?.full_name}</span>
            <span>·</span>
            <span>{profile?.employee_id}</span>
            <span>·</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
                ${profile?.role === 'admin'
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-sky-100 text-sky-700'
                }`}
            >
              {profile?.role === 'admin' ? '관리자' : '직원'}
            </span>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
