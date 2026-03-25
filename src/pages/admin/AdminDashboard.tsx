import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, UserPlus, Users, UserCheck, UserX, CalendarDays,
  ChevronRight, X, TrendingUp,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge, RoleBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  useEmployees, useCreateEmployee, useTerminateEmployee,
  type CreateEmployeePayload,
} from '../../hooks/useEmployees';
import { useToast } from '../../contexts/ToastContext';
import { DEPARTMENTS, POSITIONS, DEPARTMENT_LABELS, POSITION_LABELS } from '../../types/database';
import type { Profile, UserStatus, Department, Position } from '../../types/database';

// ── 통계 카드 ─────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  iconBg: string;
  iconColor: string;
  accent: string;
}

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor, accent }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      {/* 좌측 컬러 바 */}
      <div className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl ${accent}`} />
      <div className="flex items-start justify-between pl-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1.5 text-3xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

// ── 스켈레톤 테이블 행 ────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 6 }).map((__, j) => (
            <td key={j} className="px-5 py-4">
              <div className="h-4 animate-pulse rounded-full bg-slate-100"
                style={{ width: `${60 + (i + j) * 7 % 35}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── 신규 직원 등록 모달 ───────────────────────────────────────────────
function CreateEmployeeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createEmployee = useCreateEmployee();
  const toast          = useToast();

  const [form, setForm]         = useState<CreateEmployeePayload>({
    email: '', password: '', full_name: '', dob: '', role: 'user',
    department: null, position: null,
  });
  // TanStack Query의 isPending에 더해 로컬 isSubmitting을 두어
  // 어떤 경로로 종료되더라도 finally에서 반드시 로딩이 해제되도록 한다.
  const [isSubmitting, setSubmitting] = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);

  const set = (key: keyof CreateEmployeePayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormError(null);
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const profile = await createEmployee.mutateAsync(form);
      toast.success(`${profile.full_name} (${profile.employee_id}) 등록 완료`);
      setForm({ email: '', password: '', full_name: '', dob: '', role: 'user', department: null, position: null });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '직원 등록에 실패했습니다.';
      // 짧은 메시지는 인라인 표시, 긴 메시지(타임아웃 등)는 토스트로만
      setFormError(msg);
      toast.error(msg);
    } finally {
      // ← 네트워크 hang / 타임아웃 / 정상 완료 어느 경우에도 로딩 해제
      setSubmitting(false);
    }
  };

  // 제출 중에는 실수로 모달을 닫지 않도록 차단
  const handleClose = () => { if (!isSubmitting) onClose(); };

  if (!open) return null;

  const busy    = isSubmitting || createEmployee.isPending;
  const inputCls = `w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm
    text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white
    focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors
    disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 제출 중 backdrop 클릭 차단 */}
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="font-bold text-slate-900">신규 직원 등록</h2>
            <p className="mt-0.5 text-xs text-slate-500">사번은 자동 생성됩니다.</p>
          </div>
          <button
            onClick={handleClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700
              disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">이름 *</label>
              <input type="text" required disabled={busy} value={form.full_name} onChange={set('full_name')}
                className={inputCls} placeholder="홍길동" />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">이메일 *</label>
              <input type="email" required disabled={busy} value={form.email} onChange={set('email')}
                className={inputCls} placeholder="hong@company.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">임시 비밀번호 *</label>
              <input type="password" required minLength={8} disabled={busy} value={form.password}
                onChange={set('password')} className={inputCls} placeholder="8자 이상" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">역할 *</label>
              <select value={form.role} disabled={busy} onChange={set('role')} className={inputCls}>
                <option value="user">직원</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">생년월일 *</label>
              <input type="date" required disabled={busy} value={form.dob} onChange={set('dob')}
                max={new Date().toISOString().split('T')[0]} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">부서</label>
              <select
                value={form.department ?? ''}
                disabled={busy}
                onChange={(e) => setForm((f) => ({ ...f, department: (e.target.value as Department) || null }))}
                className={inputCls}
              >
                <option value="">— 선택 안함 —</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">직급</label>
              <select
                value={form.position ?? ''}
                disabled={busy}
                onChange={(e) => setForm((f) => ({ ...f, position: (e.target.value as Position) || null }))}
                className={inputCls}
              >
                <option value="">— 선택 안함 —</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 인라인 에러 메시지 */}
          {formError && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600
                hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed
                active:scale-95 transition-all"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-[#004192] px-5 py-2.5
                text-sm font-semibold text-white shadow-sm shadow-[#004192]/25
                hover:bg-[#003578] disabled:opacity-50 disabled:cursor-not-allowed
                active:scale-95 transition-all"
            >
              {busy ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  등록 중...
                </>
              ) : '등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const toast = useToast();
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [status, setStatus]         = useState<UserStatus | 'all'>('all');
  const [showCreate, setCreate]     = useState(false);
  const [terminateTarget, setTerminateTarget] = useState<Profile | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const terminateEmployee = useTerminateEmployee();
  const { data: employees = [], isLoading } = useEmployees({ search: debouncedSearch, status });

  const sortedEmployees = [...employees].sort((a, b) => {
    if (a.status === 'resigned' && b.status !== 'resigned') return 1;
    if (a.status !== 'resigned' && b.status === 'resigned') return -1;
    return 0;
  });

  const total        = employees.length;
  const activeCount  = employees.filter((e) => e.status === 'active').length;
  const resignedCount = employees.filter((e) => e.status === 'resigned').length;
  const thisMonthCount = employees.filter((e) => {
    const created = new Date(e.created_at);
    const now = new Date();
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }).length;

  const handleTerminate = async () => {
    if (!terminateTarget) return;
    try {
      await terminateEmployee.mutateAsync(terminateTarget.id);
      toast.success(`${terminateTarget.full_name} 퇴사 처리 완료 — 세션이 즉시 만료됩니다.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '퇴사 처리에 실패했습니다.');
    } finally {
      setTerminateTarget(null);
    }
  };

  return (
    <AppLayout>
      {/* Modals */}
      <ConfirmDialog
        open={!!terminateTarget}
        title="퇴사 처리 확인"
        description={
          <>
            <span className="font-semibold text-slate-900">{terminateTarget?.full_name}</span>
            {' '}({terminateTarget?.employee_id})을 퇴사 처리하시겠습니까?{' '}
            <br /><br />
            <span className="font-medium text-red-600">
              처리 즉시 해당 직원의 세션이 만료되고 모든 접근이 차단됩니다.
            </span>
          </>
        }
        confirmLabel="퇴사 처리"
        danger
        isLoading={terminateEmployee.isPending}
        onConfirm={handleTerminate}
        onCancel={() => setTerminateTarget(null)}
      />
      <CreateEmployeeModal open={showCreate} onClose={() => setCreate(false)} />

      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">직원 관리</h1>
          <p className="mt-1 text-sm text-slate-500">전체 임직원 현황 및 배경 조회를 관리합니다.</p>
        </div>
        <button
          onClick={() => setCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-[#004192] px-4 py-2.5
            text-sm font-semibold text-white shadow-sm shadow-[#004192]/25
            hover:bg-[#003578] active:scale-95 transition-all"
        >
          <UserPlus className="h-4 w-4" />
          신규 직원 등록
        </button>
      </div>



      {/* 검색 & 필터 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 사번으로 검색..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm
              text-slate-900 placeholder:text-slate-400
              focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20
              shadow-sm transition-colors"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as UserStatus | 'all')}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700
            shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="all">전체 상태</option>
          <option value="active">재직 중</option>
          <option value="resigned">퇴사</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['사번', '이름', '역할', '상태', '생년월일', '부서', ''].map((h) => (
                <th key={h}
                  className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <TableSkeleton />
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                    <Users className="h-10 w-10" />
                    <p className="text-sm">검색 결과가 없습니다.</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedEmployees.map((emp) => (
                <tr key={emp.id}
                  className="group transition-colors hover:bg-slate-50/80">
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-slate-500">{emp.employee_id}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {emp.avatar_url
                          ? <img src={emp.avatar_url} alt={emp.full_name} className="h-full w-full object-cover" />
                          : emp.full_name[0]
                        }
                      </div>
                      <span className="text-sm font-medium text-slate-900">{emp.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4"><RoleBadge role={emp.role} /></td>
                  <td className="px-5 py-4"><StatusBadge status={emp.status} /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {emp.dob}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-slate-500">
                      {emp.department ? DEPARTMENT_LABELS[emp.department] : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {emp.status === 'active' && (
                        <button
                          onClick={() => setTerminateTarget(emp)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5
                            text-xs font-semibold text-red-600 hover:bg-red-100
                            active:scale-95 transition-all"
                        >
                          퇴사 처리
                        </button>
                      )}
                      <Link
                        to={`/admin/employees/${emp.id}`}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white
                          px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50
                          hover:text-slate-900 active:scale-95 transition-all shadow-sm"
                      >
                        상세 <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 테이블 푸터 */}
        {!isLoading && employees.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-400">
              총 <span className="font-semibold text-slate-600">{employees.length}</span>명 표시 중
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
