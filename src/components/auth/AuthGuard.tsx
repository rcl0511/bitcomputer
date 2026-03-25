import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

/**
 * AuthGuard — 세션(로그인 여부) 검사
 *
 * - 로딩 중: 스켈레톤(추후 교체 예정)
 * - 미인증: /login 으로 redirect (현재 경로를 state에 담아 로그인 후 복원 가능)
 * - 인증됨: 하위 Route 렌더링
 *
 * 사용 예:
 *   <Route element={<AuthGuard />}>
 *     <Route element={<RoleGuard allowedRoles={['admin']} />}>
 *       <Route path="/admin/dashboard" element={<Dashboard />} />
 *     </Route>
 *   </Route>
 */
export function AuthGuard() {
  const { isAuthenticated, isLoading, authReady, signOut } = useAuth();
  const location = useLocation();

  // isLoading: 캐시 없을 때 profile fetch 대기
  // authReady: INITIAL_SESSION 처리 완료 여부 (항상 false로 시작)
  // → 둘 중 하나라도 미완이면 로딩 화면 유지
  // → lazy initializer로 isLoading이 false여도 authReady 가 true가 될 때까지 대기
  //   (이로써 INITIAL_SESSION 전에 useEmployees 등 쿼리가 실행되는 race condition 방지)
  if (isLoading || !authReady) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-slate-50">
        <span className="text-sm text-gray-400">Loading...</span>
        {/* 세션 캐시가 있어 인증 상태로 보이지만 아직 검증 중인 경우
            INITIAL_SESSION이 지연되어도 로그아웃으로 탈출할 수 있도록 */}
        {isAuthenticated && (
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </button>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
