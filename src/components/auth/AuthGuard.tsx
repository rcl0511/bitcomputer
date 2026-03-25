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
  const { isAuthenticated, isLoading, authReady } = useAuth();
  const location = useLocation();

  // isLoading: 캐시 없을 때 profile fetch 대기
  // authReady: INITIAL_SESSION 처리 완료 여부 (항상 false로 시작)
  // → 둘 중 하나라도 미완이면 로딩 화면 유지
  // → lazy initializer로 isLoading이 false여도 authReady 가 true가 될 때까지 대기
  //   (이로써 INITIAL_SESSION 전에 useEmployees 등 쿼리가 실행되는 race condition 방지)
  if (isLoading || !authReady) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #00122e 0%, #001f4d 40%, #003380 100%)',
        overflow: 'hidden',
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;600;700&display=swap');

          .guard-root { font-family: 'Noto Sans KR', sans-serif; }

          /* 그리드 패턴 */
          .guard-grid {
            position: absolute;
            inset: 0;
            background-image:
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 48px 48px;
            mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%);
            pointer-events: none;
          }

          /* 글로우 orbs */
          .guard-orb-1 {
            position: absolute;
            width: 600px; height: 600px;
            top: -200px; right: -150px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%);
            filter: blur(80px);
            pointer-events: none;
          }
          .guard-orb-2 {
            position: absolute;
            width: 400px; height: 400px;
            bottom: -100px; left: -100px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
            filter: blur(60px);
            pointer-events: none;
          }

          /* 로고 fadeIn */
          @keyframes guardFadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .guard-fade { animation: guardFadeIn 0.6s cubic-bezier(0.22,1,0.36,1) both; }
          .guard-fade-1 { animation-delay: 0.05s; }
          .guard-fade-2 { animation-delay: 0.2s; }
          .guard-fade-3 { animation-delay: 0.35s; }

          /* 진행 바 shimmer */
          @keyframes shimmer {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
          .guard-shimmer {
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
            animation: shimmer 1.6s ease-in-out infinite;
          }

          /* 점 펄스 */
          @keyframes dotPulse {
            0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
            40%            { opacity: 1;   transform: scale(1); }
          }
          .dot { animation: dotPulse 1.4s ease-in-out infinite; }
          .dot-2 { animation-delay: 0.2s; }
          .dot-3 { animation-delay: 0.4s; }
        `}</style>

        <div className="guard-grid" />
        <div className="guard-orb-1" />
        <div className="guard-orb-2" />

        {/* 로고 */}
        <div className="guard-root guard-fade guard-fade-1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '16px',
            padding: '14px 20px',
            backdropFilter: 'blur(12px)',
          }}>
            <img src="/bit_logo.png" alt="비트컴퓨터" style={{ height: '32px', width: 'auto' }} />
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>비트컴퓨터</p>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginTop: '2px' }}>
                EMPLOYEE PORTAL
              </p>
            </div>
          </div>
        </div>

        {/* 진행 바 */}
        <div className="guard-fade guard-fade-2" style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '200px', height: '3px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '100px',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div className="guard-shimmer" />
          </div>

          {/* 점 로더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <span className="dot" style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
            <span className="dot dot-2" style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
            <span className="dot dot-3" style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
          </div>
        </div>

        {/* 안내 텍스트 */}
        <div className="guard-root guard-fade guard-fade-3" style={{ marginTop: '20px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>
            인증 확인 중...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
