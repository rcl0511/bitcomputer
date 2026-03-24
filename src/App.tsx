import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { RoleGuard } from './components/auth/RoleGuard';
import { StatusGuard } from './components/auth/StatusGuard';
import { queryClient } from './lib/queryClient';

import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import PortalPage from './pages/portal/PortalPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import EmployeeDetailPage from './pages/admin/EmployeeDetailPage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {/*
          ToastProvider는 AuthProvider 바깥에 위치해야 한다.
          AuthContext의 handleResigned()에서도 toast를 쓸 수 있도록.
        */}
        <ToastProvider>
          <AuthProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Protected: 로그인 필수 */}
              <Route element={<AuthGuard />}>
                {/* resigned 즉시 차단 */}
                <Route element={<StatusGuard />}>

                  {/* User + Admin 공용 */}
                  <Route element={<RoleGuard allowedRoles={['admin', 'user']} />}>
                    <Route path="/portal" element={<PortalPage />} />
                  </Route>

                  {/* Admin 전용 */}
                  <Route element={<RoleGuard allowedRoles={['admin']} />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/employees/:profileId" element={<EmployeeDetailPage />} />
                  </Route>

                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/portal" replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
