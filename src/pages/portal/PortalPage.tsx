import { type FormEvent, useEffect, useState } from 'react';
import {
  Pencil, X, Save, BadgeCheck, CalendarDays,
  UserCircle2, IdCard, ShieldCheck, Clock,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge, RoleBadge } from '../../components/ui/Badge';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { useToast } from '../../contexts/ToastContext';

// ── 읽기 전용 행 ──────────────────────────────────────────────────────
function InfoRow({
  icon: Icon, label, children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl bg-slate-50 px-4 py-3.5 ring-1 ring-slate-100">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-slate-900">{children}</div>
      </div>
    </div>
  );
}

// ── 편집 인풋 ─────────────────────────────────────────────────────────
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none ' +
  'focus:ring-2 focus:ring-indigo-500/20 transition-colors';

export default function PortalPage() {
  const { data: profile } = useProfile();
  const updateProfile     = useUpdateProfile();
  const toast             = useToast();

  const [isEditing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [dob, setDob]           = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setDob(profile.dob);
    }
  }, [profile]);

  const handleCancel = () => {
    if (profile) { setFullName(profile.full_name); setDob(profile.dob); }
    setEditing(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.warning('이름을 입력해주세요.'); return; }
    try {
      await updateProfile.mutateAsync({ full_name: fullName.trim(), dob });
      toast.success('프로필이 업데이트되었습니다.');
      setEditing(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '업데이트에 실패했습니다.');
    }
  };

  if (!profile) return null;

  const joinedDate = new Date(profile.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">내 프로필</h1>
        <p className="mt-1 text-sm text-slate-500">개인 정보를 확인하고 수정할 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── 왼쪽: 아이덴티티 카드 ──────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {/* 그라디언트 헤더 */}
            <div className="relative h-24 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800">
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 0%, transparent 60%)' }} />
            </div>

            {/* 아바타 (헤더에 걸침) */}
            <div className="-mt-10 flex flex-col items-center px-6 pb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white
                shadow-lg ring-4 ring-white text-2xl font-bold text-indigo-600">
                {profile.full_name[0]}
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-900">{profile.full_name}</h2>
              <p className="mt-0.5 font-mono text-xs text-slate-500">{profile.employee_id}</p>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status={profile.status} />
                <RoleBadge role={profile.role} />
              </div>

              {/* 입사일 */}
              <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 ring-1 ring-slate-100">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">입사일: <span className="font-medium text-slate-700">{joinedDate}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 상세 정보 ────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">상세 정보</h3>
              {!isEditing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5
                    text-sm font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50
                    hover:text-indigo-700 active:scale-95 transition-all duration-150"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  편집
                </button>
              )}
            </div>

            <div className="p-6">
              {isEditing ? (
                /* ── 편집 폼 ── */
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text" required value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={inputClass} placeholder="홍길동"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      생년월일 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date" required value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className={inputClass}
                    />
                  </div>

                  {/* 수정 불가 필드 안내 */}
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 ring-1 ring-amber-100">
                    사번, 역할, 상태는 관리자만 변경할 수 있습니다.
                  </p>

                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={handleCancel}
                      disabled={updateProfile.isPending}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5
                        text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50
                        active:scale-95 transition-all">
                      <X className="h-4 w-4" /> 취소
                    </button>
                    <button type="submit" disabled={updateProfile.isPending}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5
                        text-sm font-semibold text-white shadow-sm shadow-indigo-600/25
                        hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all">
                      <Save className="h-4 w-4" />
                      {updateProfile.isPending ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </form>
              ) : (
                /* ── 읽기 전용 ── */
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoRow icon={UserCircle2} label="이름">{profile.full_name}</InfoRow>
                  <InfoRow icon={IdCard} label="사번">
                    <span className="font-mono">{profile.employee_id}</span>
                  </InfoRow>
                  <InfoRow icon={CalendarDays} label="생년월일">{profile.dob}</InfoRow>
                  <InfoRow icon={ShieldCheck} label="역할">
                    <RoleBadge role={profile.role} />
                  </InfoRow>
                  <InfoRow icon={BadgeCheck} label="재직 상태">
                    <StatusBadge status={profile.status} />
                  </InfoRow>
                  <InfoRow icon={Clock} label="등록일">{joinedDate}</InfoRow>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
