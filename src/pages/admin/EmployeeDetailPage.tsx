import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, Loader2, ClipboardList,
  CheckCircle, XCircle, GraduationCap, Briefcase, CreditCard,
  Clock, AlertCircle, UserX,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge, RoleBadge, CheckStatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useEmployee, useTerminateEmployee } from '../../hooks/useEmployees';
import {
  useBackgroundCheckList,
  useBackgroundCheckResult,
  useCreateBackgroundCheck,
} from '../../hooks/useBackgroundCheck';
import { useToast } from '../../contexts/ToastContext';
import { AppError } from '../../types/database';
import type { BackgroundCheckResult } from '../../types/database';

// =============================================
// Skeleton — 상세 페이지 전체 로딩
// =============================================
function PageSkeleton() {
  return (
    <AppLayout>
      <div className="mb-6 h-5 w-32 animate-pulse rounded-full bg-slate-200" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 왼쪽 카드 */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-1">
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-5 w-32 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-1 flex gap-2">
              <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {[70, 55].map((w) => (
              <div key={w} className="flex justify-between">
                <div className="h-3.5 w-16 animate-pulse rounded-full bg-slate-100" />
                <div className={`h-3.5 animate-pulse rounded-full bg-slate-100`} style={{ width: `${w}px` }} />
              </div>
            ))}
          </div>
        </div>
        {/* 오른쪽 */}
        <div className="space-y-5 lg:col-span-2">
          <div className="h-20 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" />
          <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" />
          <div className="h-36 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" />
        </div>
      </div>
    </AppLayout>
  );
}

// =============================================
// 배경 조회 결과 스켈레톤 (pending 대기 중)
// =============================================
function ResultSkeleton() {
  return (
    <div className="space-y-3">
      {/* 상태 헤더 스켈레톤 */}
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="h-3 w-56 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>
      {/* 상세 항목 스켈레톤 */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================
// 503 카운트다운
// =============================================
function RetryCountdown({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  const pct = Math.max(0, (remaining / seconds) * 100);

  return (
    <div className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <AlertCircle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">서비스 일시 과부하</p>
          <p className="text-xs text-amber-600">
            {remaining > 0 ? `${remaining}초 후 자동으로 재시도됩니다.` : '재시도 중...'}
          </p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-amber-700">{remaining}s</span>
      </div>
      {/* 프로그레스 바 */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// =============================================
// 배경 조회 결과 리포트
// =============================================
const CREDIT_MAP: Record<string, { label: string; ok: boolean }> = {
  excellent: { label: '매우 좋음', ok: true  },
  good:      { label: '좋음',     ok: true  },
  fair:      { label: '보통',     ok: true  },
  poor:      { label: '나쁨',     ok: false },
};

function ResultItem({
  icon: Icon, label, value, ok,
}: { icon: React.ElementType; label: string; value: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl p-3.5 ring-1
      ${ok ? 'bg-emerald-50 ring-emerald-100' : 'bg-red-50 ring-red-100'}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
        ${ok ? 'bg-emerald-100' : 'bg-red-100'}`}>
        <Icon className={`h-4 w-4 ${ok ? 'text-emerald-600' : 'text-red-600'}`} />
      </div>
      <div className="flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-sm font-semibold ${ok ? 'text-emerald-800' : 'text-red-800'}`}>{value}</p>
      </div>
      {ok
        ? <CheckCircle className="h-4 w-4 text-emerald-500" />
        : <XCircle className="h-4 w-4 text-red-500" />
      }
    </div>
  );
}

function CheckReport({ result }: { result: BackgroundCheckResult }) {
  const isClear    = result.status === 'clear';
  const isComplete = result.status !== 'pending';

  return (
    <div className={`space-y-3 rounded-2xl p-5 ring-1
      ${isClear ? 'bg-emerald-50/50 ring-emerald-200' : 'bg-red-50/50 ring-red-200'}`}>
      {/* 결과 헤더 */}
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm
          ${isClear ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {isClear
            ? <ShieldCheck className="h-6 w-6 text-white" />
            : <ShieldAlert className="h-6 w-6 text-white" />
          }
        </div>
        <div>
          <p className={`text-base font-bold ${isClear ? 'text-emerald-800' : 'text-red-800'}`}>
            {isClear ? '이상 없음 (Clear)' : '주의 필요 (Flagged)'}
          </p>
          <p className="text-xs text-slate-500 font-mono">{result.checkId}</p>
          {result.completedAt && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3 w-3" />
              {new Date(result.completedAt).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
      </div>

      {/* 세부 항목 */}
      {isComplete && (
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <ResultItem
            icon={ShieldCheck} label="범죄 이력"
            value={result.criminalRecord ? '기록 있음' : '기록 없음'}
            ok={!result.criminalRecord}
          />
          <ResultItem
            icon={GraduationCap} label="학력 인증"
            value={result.educationVerified ? '인증 완료' : '인증 실패'}
            ok={!!result.educationVerified}
          />
          <ResultItem
            icon={Briefcase} label="경력 인증"
            value={result.employmentVerified ? '인증 완료' : '인증 실패'}
            ok={!!result.employmentVerified}
          />
          <ResultItem
            icon={CreditCard} label="신용 등급"
            value={result.creditScore ? CREDIT_MAP[result.creditScore]?.label ?? '—' : '—'}
            ok={result.creditScore ? CREDIT_MAP[result.creditScore]?.ok ?? true : true}
          />
        </div>
      )}
    </div>
  );
}

// =============================================
// Main Page
// =============================================
export default function EmployeeDetailPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const toast         = useToast();

  const { data: employee, isLoading: loadingEmp } = useEmployee(profileId);
  const terminateEmployee = useTerminateEmployee();
  const [showTerminate, setShowTerminate] = useState(false);

  const [activeCheckId, setActiveCheckId] = useState<string | null>(null);
  const [retryAfter, setRetryAfter]       = useState<number | null>(null);

  const createCheck = useCreateBackgroundCheck();

  const { data: history, isLoading: loadingHistory } =
    useBackgroundCheckList(employee?.employee_id ?? null);

  // 페이지 진입 시 기존 pending 항목 자동 폴링 재개
  useEffect(() => {
    if (!history || activeCheckId) return;
    const pending = history.checks.find((c) => c.status === 'pending');
    if (pending) setActiveCheckId(pending.checkId);
  }, [history, activeCheckId]);

  const {
    data:       checkResult,
    error:      checkError,
    isFetching: isPolling,
  } = useBackgroundCheckResult(activeCheckId);

  useEffect(() => {
    if (checkError instanceof AppError && checkError.statusCode === 503) {
      setRetryAfter(checkError.retryAfter ?? 30);
    }
  }, [checkError]);

  useEffect(() => {
    if (!checkResult || checkResult.status === 'pending') return;
    if (checkResult.status === 'clear') toast.success('배경 조회 완료 — 이상 없음');
    else toast.warning('배경 조회 완료 — 주의 필요');
  }, [checkResult?.status]); // eslint-disable-line

  const handleRequestCheck = async () => {
    if (!employee) return;
    const [firstName, ...rest] = employee.full_name.split(' ');
    const lastName = rest.join(' ') || firstName;

    try {
      const created = await createCheck.mutateAsync({
        employeeId:  employee.employee_id,
        firstName, lastName,
        dateOfBirth: employee.dob,
      });
      setActiveCheckId(created.checkId);
      setRetryAfter(null);
      toast.success(created.status === 'pending'
        ? '배경 조회 요청 완료 — 결과를 기다리는 중입니다.'
        : '배경 조회가 즉시 완료되었습니다.'
      );
    } catch (err) {
      if (err instanceof AppError) {
        if (err.statusCode === 503) { setRetryAfter(err.retryAfter ?? 30); toast.warning(`서버 과부하 — ${err.retryAfter ?? 30}초 후 다시 시도`); }
        else toast.error(`오류: ${err.message}`);
      } else toast.error('알 수 없는 오류가 발생했습니다.');
    }
  };

  const handleTerminate = async () => {
    if (!employee) return;
    try {
      await terminateEmployee.mutateAsync(employee.id);
      toast.success(`${employee.full_name} 퇴사 처리 완료`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '퇴사 처리에 실패했습니다.');
    } finally {
      setShowTerminate(false);
    }
  };

  const isPending   = checkResult?.status === 'pending';
  const isCompleted = checkResult && checkResult.status !== 'pending';

  if (loadingEmp) return <PageSkeleton />;

  if (!employee) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center py-24 text-slate-400">
          <ShieldAlert className="mb-3 h-12 w-12" />
          <p>직원 정보를 찾을 수 없습니다.</p>
          <Link to="/admin" className="mt-4 text-sm text-indigo-600 hover:underline">목록으로</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ConfirmDialog
        open={showTerminate}
        title="퇴사 처리 확인"
        description={<><span className="font-semibold">{employee.full_name}</span>을 퇴사 처리하시겠습니까?<br /><span className="text-red-600">처리 즉시 세션이 만료됩니다.</span></>}
        confirmLabel="퇴사 처리" danger
        isLoading={terminateEmployee.isPending}
        onConfirm={handleTerminate}
        onCancel={() => setShowTerminate(false)}
      />

      {/* Back */}
      <Link to="/admin"
        className="mb-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-500
          hover:bg-slate-100 hover:text-slate-800 transition-colors -ml-2">
        <ArrowLeft className="h-4 w-4" />
        직원 목록
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── 직원 프로필 카드 ──────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {/* 그라디언트 헤더 */}
            <div className="relative h-24 bg-gradient-to-br from-slate-800 to-slate-900">
              <div className="absolute inset-0 opacity-30"
                style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, #6366f1 0%, transparent 60%)' }} />
            </div>

            {/* 아바타 */}
            <div className="-mt-10 flex flex-col items-center px-6 pb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600
                shadow-lg ring-4 ring-white text-2xl font-bold text-white">
                {employee.full_name[0]}
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-900">{employee.full_name}</h2>
              <p className="mt-0.5 font-mono text-xs text-slate-500">{employee.employee_id}</p>
              <div className="mt-3 flex gap-2">
                <StatusBadge status={employee.status} />
                <RoleBadge role={employee.role} />
              </div>
            </div>

            {/* 상세 정보 */}
            <div className="divide-y divide-slate-50 border-t border-slate-100 px-6">
              {[
                { label: '생년월일', value: employee.dob },
                { label: '등록일',   value: new Date(employee.created_at).toLocaleDateString('ko-KR') },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs font-medium text-slate-800">{value}</span>
                </div>
              ))}
            </div>

            {/* 퇴사 처리 버튼 */}
            {employee.status === 'active' && (
              <div className="p-4">
                <button
                  onClick={() => setShowTerminate(true)}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl
                    border-2 border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600
                    hover:border-red-300 hover:bg-red-100 active:scale-[0.98] transition-all"
                >
                  <UserX className="h-4 w-4" />
                  퇴사 처리
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── 배경 조회 섹션 ──────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">

          {/* 요청 버튼 */}
          <div className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div>
              <h3 className="font-semibold text-slate-900">배경 조회</h3>
              <p className="mt-0.5 text-sm text-slate-500">신원 확인 외부 API 서비스</p>
            </div>
            <button
              onClick={handleRequestCheck}
              disabled={createCheck.isPending || isPending || employee.status === 'resigned'}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5
                text-sm font-semibold text-white shadow-sm shadow-indigo-600/25
                hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50
                active:scale-95 transition-all"
            >
              {(createCheck.isPending || isPending) ? (
                <><Loader2 className="h-4 w-4 animate-spin" />조회 중...</>
              ) : (
                <><ShieldCheck className="h-4 w-4" />배경 조회 요청</>
              )}
            </button>
          </div>

          {/* 503 카운트다운 */}
          {retryAfter !== null && <RetryCountdown seconds={retryAfter} />}

          {/* 현재 조회 결과 패널 */}
          {activeCheckId && (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <ClipboardList className="h-4 w-4 text-slate-400" />
                  조회 결과
                </h4>
                {isPolling && isPending && (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1
                    text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    5초마다 자동 갱신
                  </span>
                )}
              </div>

              {isPending && !checkResult ? (
                <ResultSkeleton />
              ) : checkResult ? (
                <CheckReport result={checkResult} />
              ) : null}
            </div>
          )}

          {/* 조회 이력 */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ClipboardList className="h-4 w-4 text-slate-400" />
              조회 이력
              {history && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {history.totalCount}건
                </span>
              )}
            </h4>

            {loadingHistory ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : !history?.checks.length ? (
              <div className="flex flex-col items-center py-10 text-slate-400">
                <ShieldCheck className="mb-2 h-9 w-9" />
                <p className="text-sm">조회 이력이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.checks.map((check) => (
                  <button
                    key={check.checkId}
                    onClick={() => setActiveCheckId(check.checkId)}
                    className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left
                      ring-1 transition-all hover:scale-[1.01]
                      ${activeCheckId === check.checkId
                        ? 'bg-indigo-50 ring-indigo-200'
                        : 'bg-slate-50 ring-slate-100 hover:bg-slate-100'
                      }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-500">{check.checkId}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        {new Date(check.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <CheckStatusBadge status={check.status} />
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
