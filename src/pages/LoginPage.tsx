import { type FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const navigate     = useNavigate();
  const location     = useLocation();
  const from         = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/portal';
  const accessDenied = !!(location.state as { accessDenied?: boolean })?.accessDenied;

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate(from, { replace: true });
    });
  }, [from, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg(
        error.message.includes('Invalid login')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : error.message,
      );
      setLoading(false);
      return;
    }

    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');

        .login-root { font-family: 'Noto Sans KR', sans-serif; }

        /* 왼쪽 패널 배경 패턴 */
        .bit-panel {
          background-color: #004192;
          background-image:
            linear-gradient(135deg, #003070 0%, #004192 50%, #0056c7 100%);
          position: relative;
          overflow: hidden;
        }

        /* 세로 바 장식 — BIT 로고 모티프 */
        .bit-bars::before {
          content: '';
          position: absolute;
          top: -10%;
          right: -60px;
          width: 180px;
          height: 120%;
          background: repeating-linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 0px,
            rgba(255,255,255,0.04) 36px,
            transparent 36px,
            transparent 56px
          );
          transform: skewX(-8deg);
        }

        .bit-bars::after {
          content: '';
          position: absolute;
          bottom: -20%;
          left: -40px;
          width: 300px;
          height: 140%;
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%);
        }

        /* 대각선 장식 라인 */
        .bit-line {
          position: absolute;
          background: rgba(255, 255, 255, 0.06);
          transform-origin: center;
        }

        /* 로그인 입력 포커스 */
        .login-input:focus {
          border-color: #004192;
          box-shadow: 0 0 0 3px rgba(0, 65, 146, 0.12);
          outline: none;
        }

        /* 로그인 버튼 shimmer */
        .btn-login {
          background: #004192;
          position: relative;
          overflow: hidden;
          transition: background 0.2s, transform 0.1s;
        }
        .btn-login::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.4s;
        }
        .btn-login:hover::after { left: 160%; }
        .btn-login:hover { background: #003578; }
        .btn-login:active { transform: scale(0.98); }

        /* 카드 페이드인 */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .fade-up-1 { animation-delay: 0.05s; }
        .fade-up-2 { animation-delay: 0.12s; }
        .fade-up-3 { animation-delay: 0.19s; }
        .fade-up-4 { animation-delay: 0.26s; }

        /* 왼쪽 콘텐츠 슬라이드인 */
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .slide-right { animation: slideRight 0.6s ease both; }
        .slide-right-1 { animation-delay: 0.1s; }
        .slide-right-2 { animation-delay: 0.25s; }
        .slide-right-3 { animation-delay: 0.4s; }
      `}</style>

      {/* ── 왼쪽: 브랜드 패널 ─────────────────────────────── */}
      <div className="bit-panel bit-bars login-root relative hidden w-[48%] flex-col justify-between p-14 lg:flex">

        {/* 장식 원형 */}
        <div style={{
          position: 'absolute', top: '-80px', right: '60px',
          width: '320px', height: '320px', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', top: '40px', right: '140px',
          width: '160px', height: '160px', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.08)',
        }} />
        <div style={{
          position: 'absolute', bottom: '60px', left: '-60px',
          width: '280px', height: '280px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
        }} />

        {/* 상단 로고 */}
        <div className="slide-right slide-right-1 relative z-10 flex items-center gap-4">
          <img src="/bit_logo.png" alt="비트컴퓨터" className="h-10 w-auto"  />
          
          <div>
            <p className="text-base font-semibold text-white leading-tight">비트컴퓨터</p>
            <p className="text-xs text-white/50 mt-0.5 font-light tracking-wide">BIT COMPUTER CO., LTD.</p>
          </div>
        </div>

        {/* 중앙 메인 카피 */}
        <div className="relative z-10">
          <div className="slide-right slide-right-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase mb-4">
              Human Resources Management
            </p>
            <h1 style={{ fontSize: '5rem', fontWeight: 700, lineHeight: 1.2, color: '#fff' }}>
              인사관리<br />
              <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 300 }}>시스템</span>
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-white/50 font-light" style={{ maxWidth: '340px' }}>
              임직원 정보 관리부터 배경 조회까지,<br />
              비트컴퓨터의 스마트 인사관리 플랫폼
            </p>
          </div>

          {/* 구분선 */}
          <div className="slide-right slide-right-3 mt-10">
            <div style={{ width: '48px', height: '2px', background: 'rgba(255,255,255,0.25)', marginBottom: '32px' }} />

            {/* 기능 항목 */}
            {[
              { num: '01', label: '임직원 통합 관리' },
              { num: '02', label: '실시간 접근 권한 제어' },
              { num: '03', label: '신원 조회 자동화' },
            ].map(({ num, label }) => (
              <div key={num} className="flex items-center gap-4 mb-6 last:mb-0">
                <span style={{
                  fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '0.1em', minWidth: '24px',
                }}>{num}</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 카피라이트 */}
        <div className="relative z-10">
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
            © 2026 BIT COMPUTER CO., LTD. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── 오른쪽: 로그인 폼 ──────────────────────────────── */}
      <div className="login-root flex flex-1 flex-col items-center justify-center bg-white px-8 py-12" style={{ background: '#f8f9fc' }}>
        <div className="w-full max-w-[380px]">

          {/* 모바일 로고 */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/bit_logo.png" alt="비트컴퓨터" className="h-8 w-auto" />
            <span className="font-bold text-slate-900" style={{ color: '#004192' }}>비트컴퓨터</span>
          </div>

          {/* 폼 카드 */}
          <div className="fade-up" style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '40px 36px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {/* 헤더 */}
            <div className="fade-up fade-up-1 mb-8">
              <div className="flex items-center gap-2 mb-5">
                <img src="/bit_logo.png" alt="비트컴퓨터" className="h-6 w-auto hidden lg:block" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#004192', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  인사관리 시스템
                </span>
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                로그인
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 400 }}>
                계정 정보를 입력해 주세요.
              </p>
            </div>

            {/* Access Denied 배너 */}
            {accessDenied && (
              <div className="fade-up fade-up-1 mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-800">접근이 차단되었습니다</p>
                  <p className="mt-0.5 text-xs text-red-600">퇴사 처리된 계정입니다. 인사팀에 문의하세요.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* 이메일 */}
              <div className="fade-up fade-up-2">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', letterSpacing: '0.03em' }}>
                  이메일
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@bit.kr"
                  className="login-input"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '11px 14px',
                    fontSize: '14px',
                    color: '#0f172a',
                    background: '#f8fafc',
                    transition: 'all 0.2s',
                  }}
                />
              </div>

              {/* 비밀번호 */}
              <div className="fade-up fade-up-3">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', letterSpacing: '0.03em' }}>
                  비밀번호
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="login-input"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '11px 44px 11px 14px',
                      fontSize: '14px',
                      color: '#0f172a',
                      background: '#f8fafc',
                      transition: 'all 0.2s',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8', background: 'none', border: 'none',
                      cursor: 'pointer', padding: '2px',
                      transition: 'color 0.15s',
                    }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* 에러 메시지 */}
              {errorMsg && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '10px', padding: '10px 14px',
                  fontSize: '13px', color: '#dc2626',
                }}>
                  {errorMsg}
                </div>
              )}

              {/* 로그인 버튼 */}
              <div className="fade-up fade-up-4" style={{ paddingTop: '4px' }}>
                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className="btn-login"
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '10px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isLoading || !email || !password ? 'not-allowed' : 'pointer',
                    opacity: isLoading || !email || !password ? 0.55 : 1,
                    letterSpacing: '0.03em',
                    fontFamily: 'inherit',
                  }}
                >
                  {isLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      로그인 중...
                    </span>
                  ) : '로그인'}
                </button>
              </div>
            </form>
          </div>

          {/* 하단 안내 */}
          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#cbd5e1' }}>
            비트컴퓨터 임직원 전용 시스템입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
