import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * StatusGuard — 퇴사(resigned) 상태 감시 (React 렌더 레이어 안전망)
 *
 * AuthContext의 Realtime 구독이 이미 즉시 signOut을 처리하지만,
 * StatusGuard는 렌더 사이클에서 status를 한 번 더 확인해 이중으로 차단한다.
 *
 * 시나리오:
 *   1. 관리자가 "퇴사" 버튼 클릭
 *   2. Supabase Realtime → AuthContext.handleResigned() → signOut() + navigate('/login')
 *      (이 경로가 정상적인 주경로, 거의 즉시 실행됨)
 *   3. 만약 네트워크 지연으로 Realtime이 늦게 도착할 경우
 *      → 다음 렌더에서 StatusGuard가 profile.status를 확인 후 redirect
 *
 * 사용 예:
 *   <Route element={<AuthGuard />}>
 *     <Route element={<StatusGuard />}>     ← resigned 감시
 *       <Route element={<RoleGuard allowedRoles={['admin']} />}>
 *         <Route path="/admin/*" element={<AdminLayout />} />
 *       </Route>
 *     </Route>
 *   </Route>
 */
export function StatusGuard() {
  const { profile, signOut } = useAuth();

  // useEffect: Realtime 이벤트가 도착했지만 navigate가 실행되기 전
  // 짧은 시간 동안 resigned profile이 state에 남아있을 경우를 대비
  useEffect(() => {
    if (profile?.status === 'resigned') {
      signOut();
    }
  }, [profile?.status, signOut]);

  if (!profile) return null;

  if (profile.status === 'resigned') {
    return <Navigate to="/login" state={{ accessDenied: true }} replace />;
  }

  return <Outlet />;
}
