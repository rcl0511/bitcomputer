import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, Loader2, ClipboardList,
  CheckCircle, XCircle, GraduationCap, Briefcase, CreditCard,
  Clock, AlertCircle, UserX, Calendar, Hash
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge, RoleBadge, CheckStatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useEmployee, useTerminateEmployee } from '../../hooks/useEmployees';
import {
  useBackgroundCheckList,
  useBackgroundCheckResult,
  useCreateBackgroundCheck,
  useUpdateBackgroundCheckResult,
  type CreateCheckPayload,
} from '../../hooks/useBackgroundCheck';
import { useToast } from '../../contexts/ToastContext';
import { AppError } from '../../types/database';
import type { BackgroundCheckResult } from '../../types/database';

// =============================================
// 1. Sub-Components (Skeletons & Helpers)
// =============================================

function PageSkeleton() {
  return (
    <AppLayout>
      <div className="mb-6 h-5 w-32 animate-pulse rounded-full bg-slate-200" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4 h-[400px] animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
        <div className="lg:col-span-8 space-y-6">
          <div className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
          <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
        </div>
      </div>
    </AppLayout>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-20 animate-pulse rounded-2xl bg-slate-50 ring-1 ring-slate-100" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-50 ring-1 ring-slate-100" />
        ))}
      </div>
    </div>
  );
}

function RetryCountdown({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const onRetryRef = useRef(onRetry);
  useEffect(() => { onRetryRef.current = onRetry; });

  useEffect(() => {
    if (remaining <= 0) {
      onRetryRef.current?.();
      return;
    }
    const t = setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  const pct = Math.max(0, (remaining / seconds) * 100);

  return (
    <div className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-800">서비스 일시 과부하</p>
          <p className="text-xs text-amber-600 font-medium">{remaining}초 후 자동 재시도</p>
        </div>
        <span className="text-xl font-black tabular-nums text-amber-700">{remaining}s</span>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
        <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResultItem({ icon: Icon, label, value, ok }: { icon: any; label: string; value: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
      ok ? 'border-slate-100 bg-white shadow-sm' : 'border-rose-100 bg-rose-50/30'
    }`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-100 text-rose-600'
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`truncate text-sm font-bold ${ok ? 'text-slate-700' : 'text-rose-700'}`}>{value}</p>
      </div>
      {ok ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-rose-500" />}
    </div>
  );
}

// =============================================
// 2. Main Page Component
// =============================================
export default function EmployeeDetailPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const toast = useToast();

  // API Hooks
  const { data: employee, isLoading: loadingEmp } = useEmployee(profileId);
  const terminateEmployee = useTerminateEmployee();
  const [showTerminate, setShowTerminate] = useState(false);

  const [activeCheckId, setActiveCheckId] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const pendingRetryRef = useRef<CreateCheckPayload | null>(null);

  const createCheck     = useCreateBackgroundCheck();
  const updateCheckInDb = useUpdateBackgroundCheckResult();
  const { data: history, isLoading: loadingHistory } = useBackgroundCheckList(employee?.employee_id ?? null);

  // Auto-set active check from history if pending
  useEffect(() => {
    if (!history || activeCheckId) return;
    const pending = history.checks.find((c) => c.status === 'pending');
    if (pending) setActiveCheckId(pending.checkId);
  }, [history, activeCheckId]);

  const { data: checkResult, error: checkError, isFetching: isPolling, refetch: refetchCheck } = useBackgroundCheckResult(activeCheckId);

  // Handle 503 Overload
  useEffect(() => {
    if (checkError instanceof AppError && checkError.statusCode === 503) {
      setRetryAfter(checkError.retryAfter ?? 30);
    }
  }, [checkError]);

  // 폴링 완료(pending → clear/flagged) 시 Supabase 레코드 업데이트
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const status = checkResult?.status;
    if (!status || status === 'pending') { prevStatusRef.current = status; return; }
    if (prevStatusRef.current === status) return; // 중복 호출 방지
    prevStatusRef.current = status;

    updateCheckInDb.mutate(checkResult);
    if (status === 'clear') toast.success('배경 조회 완료 — 이상 없음');
    else toast.warning('배경 조회 완료 — 주의 필요');
  }, [checkResult?.status]); // eslint-disable-line

  const handleRequestCheck = async (payload?: CreateCheckPayload) => {
    if (!employee) return;
    const [firstName, ...rest] = employee.full_name.split(' ');

    const request: CreateCheckPayload = payload ?? {
      profileId:   employee.id,
      employeeId:  employee.employee_id,
      firstName,
      lastName:    rest.join(' ') || firstName,
      dateOfBirth: employee.dob,
    };

    try {
      const created = await createCheck.mutateAsync(request);
      setActiveCheckId(created.checkId);
      setRetryAfter(null);
      pendingRetryRef.current = null;
      toast.success(
        created.status === 'pending'
          ? '신원 조회 요청 완료 — 결과를 기다리는 중입니다.'
          : '신원 조회가 즉시 완료되었습니다.',
      );
    } catch (err) {
      if (err instanceof AppError) {
        if (err.statusCode === 503) {
          const secs = err.retryAfter ?? 30;
          setRetryAfter(secs);
          pendingRetryRef.current = request;
          toast.warning(`서버 과부하 — ${secs}초 후 자동 재시도됩니다.`);
        } else {
          toast.error(`오류: ${err.message}`);
        }
      } else {
        toast.error('알 수 없는 오류가 발생했습니다.');
      }
    }
  };

  // RetryCountdown 0 도달 시 자동 재시도
  const handleAutoRetry = () => {
    setRetryAfter(null);
    if (pendingRetryRef.current) {
      handleRequestCheck(pendingRetryRef.current);
    } else if (activeCheckId) {
      refetchCheck();
    }
  };

  const isPending = checkResult?.status === 'pending';

  if (loadingEmp) return <PageSkeleton />;
  if (!employee) return <NotFoundView />;

  return (
    <AppLayout>
      <ConfirmDialog
        open={showTerminate}
        title="퇴사 처리 확인"
        description={<><span className="font-semibold">{employee.full_name}</span>님을 퇴사 처리하시겠습니까?</>}
        confirmLabel="퇴사 처리" danger
        onConfirm={async () => {
          await terminateEmployee.mutateAsync(employee.id);
          setShowTerminate(false);
          toast.success('퇴사 처리가 완료되었습니다.');
        }}
        onCancel={() => setShowTerminate(false)}
      />

      <Link to="/admin" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        직원 리스트로 돌아가기
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        
        {/* Left Profile Sidebar */}
        <div className="lg:col-span-4">
          <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white">
                  {employee.full_name[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">{employee.full_name}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <StatusBadge status={employee.status} />
                    <RoleBadge role={employee.role} />
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-400 font-medium"><Hash className="h-4 w-4" /> 사번</span>
                  <span className="font-mono font-bold text-slate-700">{employee.employee_id}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-400 font-medium"><Calendar className="h-4 w-4" /> 생년월일</span>
                  <span className="font-bold text-slate-700">{employee.dob}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-400 font-medium"><Clock className="h-4 w-4" /> 등록일</span>
                  <span className="font-bold text-slate-700">{new Date(employee.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {employee.status === 'active' && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                <button
                  onClick={() => setShowTerminate(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-all active:scale-[0.98]"
                >
                  <UserX className="h-4 w-4" />
                  계정 비활성화 (퇴사)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-8 space-y-6">
          <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50/30">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">배경 조회 리포트</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">External Identity Verification</p>
              </div>
              <button
                onClick={() => handleRequestCheck()}
                disabled={createCheck.isPending || isPending || retryAfter !== null}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                조회 요청
              </button>
            </div>

            <div className="p-6 space-y-8">
              {retryAfter !== null && (
                <RetryCountdown seconds={retryAfter} onRetry={handleAutoRetry} />
              )}

              {activeCheckId ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Current Assessment</h4>
                    {isPolling && isPending && (
                      <span className="flex items-center gap-1.5 text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md ring-1 ring-amber-100">
                        <Loader2 className="h-3 w-3 animate-spin" /> POLLING...
                      </span>
                    )}
                  </div>
                  
                  {isPending && !checkResult ? (
                    <ResultSkeleton />
                  ) : checkResult ? (
                    <div className={`rounded-2xl border p-6 ${checkResult.status === 'clear' ? 'border-emerald-100 bg-emerald-50/20' : 'border-rose-100 bg-rose-50/20'}`}>
                       <div className="mb-6 flex items-center gap-5">
                          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${checkResult.status === 'clear' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                            {checkResult.status === 'clear' ? <ShieldCheck className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
                          </div>
                          <div>
                            <p className="text-lg font-black text-slate-900">{checkResult.status === 'clear' ? 'VERIFIED' : 'ACTION REQUIRED'}</p>
                            <p className="text-xs font-mono font-medium text-slate-400">{checkResult.checkId}</p>
                          </div>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <ResultItem icon={ShieldCheck} label="Criminal Record" value={checkResult.criminalRecord ? 'Found' : 'No Record'} ok={!checkResult.criminalRecord} />
                          <ResultItem icon={GraduationCap} label="Education" value={checkResult.educationVerified ? 'Verified' : 'Unverified'} ok={!!checkResult.educationVerified} />
                          <ResultItem icon={Briefcase} label="Employment" value={checkResult.employmentVerified ? 'Verified' : 'Unverified'} ok={!!checkResult.employmentVerified} />
                          <ResultItem icon={CreditCard} label="Credit Score" value={checkResult.creditScore || '-'} ok={checkResult.creditScore !== 'poor'} />
                       </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col items-center py-16 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl">
                  <ShieldCheck className="h-12 w-12 stroke-[1.5] mb-4" />
                  <p className="text-sm font-bold text-slate-400">조회된 리포트가 없습니다.</p>
                </div>
              )}

              {/* History Section */}
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Verification History</h4>
                <div className="grid gap-2.5">
                  {loadingHistory ? (
                    [1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-50" />)
                  ) : history?.checks.map((check) => (
                    <button
                      key={check.checkId}
                      onClick={() => setActiveCheckId(check.checkId)}
                      className={`flex items-center justify-between rounded-xl px-5 py-3.5 border transition-all ${
                        activeCheckId === check.checkId ? 'border-indigo-200 bg-indigo-50/50 ring-2 ring-indigo-50' : 'border-slate-100 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-2.5 w-2.5 rounded-full ${check.status === 'clear' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : check.status === 'pending' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400'}`} />
                        <div>
                          <p className="font-mono text-[11px] font-bold text-slate-600">{check.checkId}</p>
                          <p className="text-[10px] font-medium text-slate-400">{new Date(check.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <CheckStatusBadge status={check.status} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function NotFoundView() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center py-32 text-slate-400">
        <ShieldAlert className="mb-4 h-16 w-16 opacity-10" />
        <p className="text-lg font-bold">직원 정보를 찾을 수 없습니다.</p>
        <Link to="/admin" className="mt-6 rounded-xl bg-slate-900 px-8 py-3 text-sm font-bold text-white transition-transform active:scale-95">목록으로 돌아가기</Link>
      </div>
    </AppLayout>
  );
}