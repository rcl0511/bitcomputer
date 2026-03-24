import { type FormEvent, useEffect, useState } from 'react';
import {
  Pencil, X, Save, BadgeCheck, CalendarDays,
  UserCircle2, IdCard, ShieldCheck, Clock, CheckCircle2
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge, RoleBadge } from '../../components/ui/Badge';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { useToast } from '../../contexts/ToastContext';

// ── 공통 UI 컴포넌트 (가독성 중심) ─────────────────────────────────────────
function InfoField({ icon: Icon, label, value, isMono = false }: { 
  icon: React.ElementType; label: string; value: string | React.ReactNode; isMono?: boolean 
}) {
  return (
    <div className="group flex flex-col gap-1.5 p-4 transition-all hover:bg-slate-50/80 rounded-2xl border border-transparent hover:border-slate-100">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-[15px] font-semibold ${isMono ? 'font-mono text-indigo-600' : 'text-slate-800'}`}>
        {value}
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 ' +
  'transition-all duration-200 outline-none shadow-sm';

export default function PortalPage() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const toast = useToast();

  const [isEditing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setDob(profile.dob);
    }
  }, [profile]);

  if (!profile) return null;

  const joinedDate = new Date(profile.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-4">
        {/* 상단 헤더: 타이틀과 버튼 배치 최적화 */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">내 프로필</h1>
            <p className="mt-1.5 text-slate-500">인사 시스템에 등록된 소중한 개인 정보입니다.</p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 transition-all active:scale-95"
            >
              <Pencil className="h-4 w-4 text-indigo-500" />
              프로필 편집
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* ── 왼쪽: 프로필 요약 카드 ─────────────────────────── */}
          <div className="lg:col-span-4">
            <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/40 ring-1 ring-slate-200/50">
              {/* 상단 배경 컬러 */}
              <div className="h-32 bg-indigo-600 relative overflow-hidden">
                 <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_120%,#ffffff_0%,transparent_50%)]" />
              </div>
              
              <div className="relative -mt-16 flex flex-col items-center px-6 pb-10">
                <div className="relative group">
                  <div className="flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white text-4xl font-black text-indigo-600 shadow-2xl ring-[12px] ring-white">
                    {profile.full_name[0]}
                  </div>
                  <div className="absolute bottom-1 right-1 rounded-full bg-emerald-500 p-2.5 ring-4 ring-white shadow-lg">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <h2 className="text-2xl font-bold text-slate-900">{profile.full_name}</h2>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-tighter">
                    <IdCard className="h-3 w-3" />
                    {profile.employee_id}
                  </div>
                </div>

                <div className="mt-8 flex w-full flex-col gap-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 px-5 py-4 ring-1 ring-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">STATUS</span>
                    <StatusBadge status={profile.status} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 px-5 py-4 ring-1 ring-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">ACCESS</span>
                    <RoleBadge role={profile.role} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 오른쪽: 상세 정보 ────────────────────────────────── */}
          <div className="lg:col-span-8">
            <div className="h-full rounded-[2.5rem] bg-white p-2 shadow-xl shadow-slate-200/40 ring-1 ring-slate-200/50">
              <div className="h-full p-6 lg:p-10">
                {isEditing ? (
                  /* 편집 모드 */
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await updateProfile.mutateAsync({ full_name: fullName.trim(), dob });
                      toast.success('변경사항이 안전하게 저장되었습니다.');
                      setEditing(false);
                    }}
                    className="flex flex-col h-full space-y-8"
                  >
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">이름 (Full Name)</label>
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="성함을 입력하세요" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">생년월일 (DOB)</label>
                        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-amber-50/60 p-5 border border-amber-100 flex gap-4">
                      <ShieldCheck className="h-6 w-6 text-amber-500 shrink-0" />
                      <div className="text-sm leading-relaxed text-amber-800">
                        <p className="font-bold mb-1">보안 안내</p>
                        직급, 권한, 입사 정보 등은 인사팀 승인 하에 수정 가능합니다. 
                        오기재된 정보가 있다면 관리자에게 문의 바랍니다.
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-end gap-4 pt-8 border-t border-slate-100">
                      <button 
                        type="button" 
                        onClick={() => { setFullName(profile.full_name); setDob(profile.dob); setEditing(false); }} 
                        className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        변경 취소
                      </button>
                      <button 
                        type="submit" 
                        disabled={updateProfile.isPending} 
                        className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-10 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {updateProfile.isPending ? '저장 중...' : '변경사항 저장'}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* 읽기 전용 모드 */
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <InfoField icon={UserCircle2} label="성명" value={profile.full_name} />
                    <InfoField icon={IdCard} label="사원 번호" value={profile.employee_id} isMono />
                    <InfoField icon={CalendarDays} label="생년월일" value={profile.dob} />
                    <InfoField icon={ShieldCheck} label="권한 등급" value={<RoleBadge role={profile.role} />} />
                    <InfoField icon={Clock} label="입사 일자" value={joinedDate} />
                    <InfoField icon={BadgeCheck} label="검증 상태" value="시스템 인증됨" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}