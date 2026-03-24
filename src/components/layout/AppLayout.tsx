import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Building2,
  LayoutDashboard,
  User,
  LogOut,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

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
  const { error } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

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

        {/* User Card */}
        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-3">
            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{profile?.full_name}</p>
              <p className="truncate text-xs text-slate-400">{profile?.employee_id}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="로그아웃"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {isAdmin && (
            <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600/10 px-3 py-1.5">
              <Shield className="h-3 w-3 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-400">관리자 권한</span>
            </div>
          )}
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
