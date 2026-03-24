import type { UserRole, UserStatus, CheckStatus } from '../../types/database';

// ── 공통 베이스 ────────────────────────────────────────────────────────
const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset';

// =============================================
// StatusBadge — active / resigned
// =============================================
const STATUS_CONFIG: Record<UserStatus, { dot: string; label: string; style: string }> = {
  active: {
    dot:   'bg-slate-400',
    label: '재직 중',
    style: 'bg-slate-50 text-slate-600 ring-slate-300/50',
  },
  resigned: {
    dot:   'bg-slate-400',
    label: '퇴사',
    style: 'bg-slate-50 text-slate-600 ring-slate-300/50',
  },
};

export function StatusBadge({ status }: { status: UserStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`${base} ${cfg.style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${status === 'active' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

// =============================================
// RoleBadge — admin / user
// =============================================
const ROLE_CONFIG: Record<UserRole, { label: string; style: string }> = {
  admin: { label: '관리자', style: 'bg-slate-50 text-slate-600 ring-slate-300/50' },
  user:  { label: '직원',   style: 'bg-slate-50 text-slate-600 ring-slate-300/50' },
};

export function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  return <span className={`${base} ${cfg.style}`}>{cfg.label}</span>;
}

// =============================================
// CheckStatusBadge — pending / clear / flagged
// =============================================
const CHECK_CONFIG: Record<CheckStatus, { dot: string; label: string; style: string }> = {
  pending: {
    dot:   'bg-amber-500 animate-pulse',
    label: '조회 중',
    style: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  },
  clear: {
    dot:   'bg-emerald-500',
    label: '이상 없음',
    style: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  },
  flagged: {
    dot:   'bg-red-500',
    label: '주의 필요',
    style: 'bg-red-50 text-red-700 ring-red-600/15',
  },
};

export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  const cfg = CHECK_CONFIG[status];
  return (
    <span className={`${base} ${cfg.style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
