import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Pencil, Save, BadgeCheck, CalendarDays,
  UserCircle2, IdCard, ShieldCheck, Clock, CheckCircle2,
  Building2, Briefcase, ShieldAlert, Camera, Mail, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AppLayout } from '../../components/layout/AppLayout';
import { StatusBadge, RoleBadge } from '../../components/ui/Badge';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { DEPARTMENTS, POSITIONS, DEPARTMENT_LABELS, POSITION_LABELS } from '../../types/database';
import type { Profile, Department, Position, UserRole, UserStatus } from '../../types/database';

// ── 아바타 업로드 컴포넌트 ────────────────────────────────────────────────────
function AvatarUpload({ profile, onUploaded }: { profile: Profile; onUploaded: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      toast.error('이미지 파일은 5MB 이하만 업로드할 수 있습니다.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
      onUploaded(publicUrl);
    } catch (err) {
      console.error('[AvatarUpload]', err);
      toast.error('프로필 사진 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="relative group">
      {/* 아바타 이미지 or 이니셜 */}
      <div className="flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white text-4xl font-black text-[#004192] shadow-2xl ring-[12px] ring-white overflow-hidden">
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt="프로필" className="h-full w-full object-cover" />
          : profile.full_name[0]
        }
      </div>

      {/* 재직 중 뱃지 */}
      <div className="absolute bottom-1 right-1 rounded-full bg-emerald-500 p-2.5 ring-4 ring-white shadow-lg">
        <CheckCircle2 className="h-4 w-4 text-white" />
      </div>

      {/* 업로드 오버레이 (hover) */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="absolute inset-0 flex items-center justify-center rounded-[2.5rem] bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {uploading
          ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          : <Camera className="h-6 w-6 text-white drop-shadow" />
        }
      </button>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── 공통 UI 컴포넌트 ──────────────────────────────────────────────────────────
function InfoField({ icon: Icon, label, value, isMono = false }: {
  icon: React.ElementType; label: string; value: string | React.ReactNode; isMono?: boolean
}) {
  return (
    <div className="group flex flex-col gap-1.5 p-4 transition-all hover:bg-slate-50/80 rounded-2xl border border-transparent hover:border-slate-100">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-[15px] font-semibold ${isMono ? 'font-mono text-[#004192]' : 'text-slate-800'}`}>
        {value}
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 ' +
  'transition-all duration-200 outline-none shadow-sm';

const selectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 ' +
  'focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 ' +
  'transition-all duration-200 outline-none shadow-sm cursor-pointer';

const disabledInputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400 ' +
  'outline-none shadow-sm cursor-not-allowed';

export default function PortalPage() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { session } = useAuth();

  const [isEditing, setEditing] = useState(false);
  const [fullName,   setFullName]   = useState('');
  const [dob,        setDob]        = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [position,   setPosition]   = useState<Position   | ''>('');
  const [role,       setRole]       = useState<UserRole>('user');
  const [status,     setStatus]     = useState<UserStatus>('active');
  const [email,        setEmail]        = useState('');
  const [newPassword,  setNewPassword]  = useState('');
  const [confirmPw,    setConfirmPw]    = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setDob(profile.dob);
      setDepartment(profile.department ?? '');
      setPosition(profile.position ?? '');
      setRole(profile.role);
      setStatus(profile.status);
    }
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  }, [profile, session]);

  if (!profile) return null;

  const joinedDate = new Date(profile.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleCancel = () => {
    setFullName(profile.full_name);
    setDob(profile.dob);
    setDepartment(profile.department ?? '');
    setPosition(profile.position ?? '');
    setRole(profile.role);
    setStatus(profile.status);
    setEmail(session?.user?.email ?? '');
    setNewPassword('');
    setConfirmPw('');
    setEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 비밀번호 확인
    if (newPassword && newPassword !== confirmPw) {
      toast.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    const payload = isAdmin
      ? {
          full_name:  fullName.trim(),
          dob,
          department: (department as Department) || null,
          position:   (position   as Position)   || null,
          role,
          status,
        }
      : { full_name: fullName.trim(), dob };

    await updateProfile.mutateAsync(payload);

    // 이메일 변경
    const currentEmail = session?.user?.email ?? '';
    if (email.trim() && email.trim() !== currentEmail) {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) {
        toast.error(`이메일 변경 실패: ${error.message}`);
        return;
      }
      toast.success('이메일 변경 확인 메일이 발송되었습니다. 메일을 확인해주세요.');
    }

    // 비밀번호 변경
    if (newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(`비밀번호 변경 실패: ${error.message}`);
        return;
      }
    }

    toast.success('변경사항이 안전하게 저장되었습니다.');
    setNewPassword('');
    setConfirmPw('');
    setEditing(false);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-4">
        {/* 상단 헤더 */}
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
          {/* ── 왼쪽: 프로필 요약 카드 ────────────────────────────── */}
          <div className="lg:col-span-4">
            <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/40 ring-1 ring-slate-200/50">
              <div className="h-32 bg-[#004192] relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_120%,#ffffff_0%,transparent_50%)]" />
              </div>

              <div className="relative -mt-16 flex flex-col items-center px-6 pb-10">
                <AvatarUpload profile={profile} onUploaded={(url) => {
                  // 캐시 갱신 — useProfile이 자동으로 새 avatar_url을 반영
                  queryClient.setQueryData(['profile', profile.id], { ...profile, avatar_url: url });
                }} />

                <div className="mt-6 text-center">
                  <h2 className="text-2xl font-bold text-slate-900">{profile.full_name}</h2>
                  {/* Department / Position 표시 */}
                  {(profile.department || profile.position) && (
                    <p className="mt-1 text-sm text-slate-500">
                      {[
                        profile.position   ? POSITION_LABELS[profile.position]     : null,
                        profile.department ? DEPARTMENT_LABELS[profile.department]  : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-tighter">
                    <IdCard className="h-3 w-3" />
                    {profile.employee_id}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── 오른쪽: 상세 정보 ─────────────────────────────────── */}
          <div className="lg:col-span-8">
            <div className="h-full rounded-[2.5rem] bg-white p-2 shadow-xl shadow-slate-200/40 ring-1 ring-slate-200/50">
              <div className="h-full p-6 lg:p-10">
                {isEditing ? (
                  /* 편집 모드 */
                  <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-8">
                    {/* 보안 안내 (일반 직원만) */}
                    {!isAdmin && (
                      <div className="rounded-2xl bg-amber-50/60 p-5 border border-amber-100 flex gap-4">
                        <ShieldCheck className="h-6 w-6 text-amber-500 shrink-0" />
                        <div className="text-sm leading-relaxed text-amber-800">
                          <p className="font-bold mb-1">보안 안내</p>
                          직급, 권한, 입사 정보 등은 인사팀 승인 하에 수정 가능합니다.
                          오기재된 정보가 있다면 관리자에게 문의 바랍니다.
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {/* 이름 */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">이름 (Full Name)</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={inputClass}
                          placeholder="성함을 입력하세요"
                        />
                      </div>

                      {/* 생년월일 */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">생년월일 (DOB)</label>
                        <input
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className={inputClass}
                        />
                      </div>

                      {/* 부서 */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">부서 (Department)</label>
                        {isAdmin ? (
                          <select
                            value={department}
                            onChange={(e) => setDepartment(e.target.value as Department | '')}
                            className={selectClass}
                          >
                            <option value="">— 선택 안함 —</option>
                            {DEPARTMENTS.map((d) => (
                              <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={profile.department ? DEPARTMENT_LABELS[profile.department] : '—'}
                            disabled
                            className={disabledInputClass}
                          />
                        )}
                      </div>

                      {/* 직급 */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">직급 (Position)</label>
                        {isAdmin ? (
                          <select
                            value={position}
                            onChange={(e) => setPosition(e.target.value as Position | '')}
                            className={selectClass}
                          >
                            <option value="">— 선택 안함 —</option>
                            {POSITIONS.map((p) => (
                              <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={profile.position ? POSITION_LABELS[profile.position] : '—'}
                            disabled
                            className={disabledInputClass}
                          />
                        )}
                      </div>

                      {/* 권한 (Admin only) */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">권한 (Role)</label>
                        {isAdmin ? (
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            className={selectClass}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={profile.role}
                            disabled
                            className={disabledInputClass}
                          />
                        )}
                      </div>

                      {/* 상태 (Admin only) */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">재직 상태 (Status)</label>
                        {isAdmin ? (
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as UserStatus)}
                            className={selectClass}
                          >
                            <option value="active">Active</option>
                            <option value="resigned">Resigned</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={profile.status}
                            disabled
                            className={disabledInputClass}
                          />
                        )}
                      </div>
                    </div>

                    {/* 계정 보안 섹션 */}
                    <div className="space-y-4 border-t border-slate-100 pt-6">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">계정 보안</p>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {/* 이메일 */}
                        <div className="space-y-3 sm:col-span-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">이메일 (Email)</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={inputClass}
                            placeholder="새 이메일 주소"
                          />
                        </div>

                        {/* 새 비밀번호 */}
                        <div className="space-y-3">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">새 비밀번호 (Password)</label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={inputClass}
                            placeholder="변경하지 않으려면 비워두세요"
                          />
                        </div>

                        {/* 비밀번호 확인 */}
                        <div className="space-y-3">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">비밀번호 확인</label>
                          <input
                            type="password"
                            value={confirmPw}
                            onChange={(e) => setConfirmPw(e.target.value)}
                            className={`${inputClass} ${newPassword && confirmPw && newPassword !== confirmPw ? 'border-red-400 focus:border-red-400 focus:ring-red-400/10' : ''}`}
                            placeholder="새 비밀번호를 다시 입력하세요"
                          />
                          {newPassword && confirmPw && newPassword !== confirmPw && (
                            <p className="text-xs text-red-500 ml-1">비밀번호가 일치하지 않습니다.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-end gap-4 pt-8 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        변경 취소
                      </button>
                      <button
                        type="submit"
                        disabled={updateProfile.isPending}
                        className="flex items-center gap-2 rounded-2xl bg-[#004192] px-10 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#004192]/20 hover:bg-[#003578] active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {updateProfile.isPending ? '저장 중...' : '변경사항 저장'}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* 읽기 전용 모드 */
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <InfoField icon={UserCircle2}  label="성명"       value={profile.full_name} />
                    <InfoField icon={IdCard}        label="사원 번호"  value={profile.employee_id} isMono />
                    <InfoField icon={CalendarDays}  label="생년월일"   value={profile.dob} />
                    <InfoField icon={ShieldCheck}   label="권한 등급"  value={<RoleBadge role={profile.role} />} />
                    <InfoField icon={Building2}     label="부서"       value={profile.department ? DEPARTMENT_LABELS[profile.department] : '—'} />
                    <InfoField icon={Briefcase}     label="직급"       value={profile.position   ? POSITION_LABELS[profile.position]   : '—'} />
                    <InfoField icon={Clock}         label="입사 일자"  value={joinedDate} />
                    <InfoField icon={BadgeCheck}    label="검증 상태"  value="시스템 인증됨" />
                    <InfoField icon={Mail}          label="이메일"     value={session?.user?.email ?? '—'} />
                    <InfoField icon={Lock}          label="비밀번호"   value="••••••••" />
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
