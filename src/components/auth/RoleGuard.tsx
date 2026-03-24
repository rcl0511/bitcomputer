import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types/database';

interface RoleGuardProps {
  /** 접근을 허용할 역할 목록 */
  allowedRoles: UserRole[];
}

/**
 * RoleGuard — RBAC(역할 기반 접근 제어) 검사
 *
 * AuthGuard 내부에 중첩해서 사용한다.
 * profile이 없는 경우(AuthGuard에서 걸렸어야 하는 경우)는 null 반환.
 *
 * 사용 예:
 *   <Route element={<AuthGuard />}>
 *     <Route element={<RoleGuard allowedRoles={['admin']} />}>
 *       <Route path="/admin/*" element={<AdminLayout />} />
 *     </Route>
 *     <Route element={<RoleGuard allowedRoles={['admin', 'user']} />}>
 *       <Route path="/portal/*" element={<PortalLayout />} />
 *     </Route>
 *   </Route>
 */
export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { profile } = useAuth();

  // AuthGuard를 통과한 이후이므로 profile은 존재해야 한다.
  // null인 경우는 방어적으로 처리.
  if (!profile) return null;

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
