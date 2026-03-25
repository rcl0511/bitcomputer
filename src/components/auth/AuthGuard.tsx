import { Navigate, Outlet, useLocation } from 'react-router-dom';
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
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
