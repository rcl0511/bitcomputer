import { type FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Building2, Eye, EyeOff, ShieldAlert, Lock, Mail,
  Users, BarChart3, ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// 왼쪽 브랜딩 패널에 표시되는 피처 목록
const FEATURES = [
  { icon: Users,       text: '직원 계정 통합 관리' },
  { icon: ShieldCheck, text: '실시간 접근 권한 제어' },
  { icon: BarChart3,   text: '배경 조회 자동화' },
];

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
    <div className="flex min-h-screen">

      {/* ── 왼쪽: 브랜딩 패널 ─────────────────────────────────── */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-slate-900 p-12 lg:flex">
        {/* 배경 장식 */}
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-12 h-80 w-80 rounded-full bg-violet-600/15 blur-3xl" />

        {/* 상단 로고 */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-900/50">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-white">IEP</p>
            <p className="text-xs text-slate-500">Internal Employee Portal</p>
          </div>
        </div>

        {/* 중앙 카피 */}
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight text-white">
            사내 직원<br />
            <span className="text-indigo-400">관리 시스템</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            인사 데이터를 안전하게 관리하고<br />
            실시간으로 접근 권한을 제어합니다.
          </p>

          {/* Feature list */}
          <ul className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-slate-700">
                  <Icon className="h-4 w-4 text-indigo-400" />
                </div>
                <span className="text-sm text-slate-300">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 하단 */}
        <p className="relative text-xs text-slate-600">
          © 2026 Internal Employee Portal. All rights reserved.
        </p>
      </div>

      {/* ── 오른쪽: 로그인 폼 ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-sm">

          {/* 모바일 로고 (lg 이하) */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">IEP</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">로그인</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            계정 정보를 입력하여 포털에 접근하세요.
          </p>

          {/* Access Denied 배너 */}
          {accessDenied && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold text-red-800">접근이 차단되었습니다</p>
                <p className="mt-0.5 text-xs text-red-600">
                  퇴사 처리된 계정입니다. 인사팀에 문의하세요.
                </p>
              </div>
            </div>
          )}

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hong@company.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4
                    text-sm text-slate-900 placeholder:text-slate-400
                    focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                    transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10
                    text-sm text-slate-900 placeholder:text-slate-400
                    focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                    transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400
                    hover:text-slate-600 transition-colors"
                  aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="group relative w-full overflow-hidden rounded-xl bg-indigo-600 px-4 py-3
                text-sm font-semibold text-white shadow-sm shadow-indigo-600/30
                hover:bg-indigo-700 active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                transition-all duration-150"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  로그인 중...
                </span>
              ) : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
