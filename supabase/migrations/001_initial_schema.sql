-- =============================================
-- Internal Employee Portal (IEP) - Initial Schema
-- =============================================

-- =============================================
-- Extensions
-- =============================================
create extension if not exists "uuid-ossp";

-- =============================================
-- Custom ENUM Types
-- =============================================
create type public.user_role            as enum ('admin', 'user');
create type public.user_status          as enum ('active', 'resigned');
create type public.check_status         as enum ('pending', 'clear', 'flagged');
create type public.credit_score_rating  as enum ('excellent', 'good', 'fair', 'poor');

-- =============================================
-- Tables
-- =============================================

create table public.profiles (
  id          uuid            not null references auth.users on delete cascade,
  employee_id text            not null,
  full_name   text            not null,
  role        user_role       not null default 'user',
  status      user_status     not null default 'active',
  dob         date            not null,
  created_at  timestamptz     not null default now(),

  constraint profiles_pkey              primary key (id),
  constraint profiles_employee_id_key   unique (employee_id),
  -- EMP-YYYY-XXX 형식 강제
  constraint profiles_employee_id_fmt   check (employee_id ~ '^EMP-\d{4}-\d{3}$')
);

create table public.background_checks (
  id                  uuid                not null default uuid_generate_v4(),
  profile_id          uuid                not null references public.profiles(id) on delete cascade,
  employee_id         text                not null,  -- profiles.employee_id 역정규화 (조회 편의)
  check_id            text                not null,  -- 외부 API 반환값 (CHK-...)
  status              check_status        not null default 'pending',
  criminal_record     boolean,
  education_verified  boolean,
  employment_verified boolean,
  credit_score        credit_score_rating,
  created_at          timestamptz         not null default now(),
  completed_at        timestamptz,

  constraint background_checks_pkey         primary key (id),
  constraint background_checks_check_id_key unique (check_id)
);

-- =============================================
-- Indexes
-- =============================================
create index idx_profiles_status              on public.profiles(status);
create index idx_profiles_role                on public.profiles(role);
create index idx_bc_profile_id               on public.background_checks(profile_id);
create index idx_bc_employee_id              on public.background_checks(employee_id);
create index idx_bc_status                   on public.background_checks(status);

-- =============================================
-- Security Definer Helper Functions
-- RLS 정책 내부에서 profiles를 재귀 조회하면 무한 루프가 발생하므로,
-- security definer 함수를 통해 RLS를 우회하고 현재 사용자의 role/status를 안전하게 반환한다.
-- =============================================

-- 현재 인증된 사용자의 status를 반환
create or replace function public.get_my_status()
returns public.user_status
language sql
security definer
stable
set search_path = public
as $$
  select status from public.profiles where id = auth.uid();
$$;

-- 현재 인증된 사용자의 role을 반환
create or replace function public.get_my_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- =============================================
-- Row Level Security (RLS)
-- =============================================
alter table public.profiles         enable row level security;
alter table public.background_checks enable row level security;

-- ---- profiles 정책 ----

-- [SELECT] active 사용자는 자신의 row만 조회 가능
create policy "users_select_own"
  on public.profiles for select
  using (
    id = auth.uid()
    and get_my_status() = 'active'
  );

-- [SELECT] active admin은 모든 row 조회 가능
create policy "admins_select_all"
  on public.profiles for select
  using (
    get_my_status() = 'active'
    and get_my_role() = 'admin'
  );

-- [INSERT] active admin만 신규 직원 등록 가능
create policy "admins_insert"
  on public.profiles for insert
  with check (
    get_my_status() = 'active'
    and get_my_role() = 'admin'
  );

-- [UPDATE] active admin은 모든 프로필 수정 가능 (퇴사 처리 포함)
create policy "admins_update_all"
  on public.profiles for update
  using (
    get_my_status() = 'active'
    and get_my_role() = 'admin'
  )
  with check (
    get_my_status() = 'active'
    and get_my_role() = 'admin'
  );

-- [UPDATE] active 사용자는 자신의 프로필만 수정 가능
create policy "users_update_own"
  on public.profiles for update
  using (
    id = auth.uid()
    and get_my_status() = 'active'
  )
  with check (
    id = auth.uid()
    and get_my_status() = 'active'
  );

-- ---- background_checks 정책 ----

-- [ALL] active admin: 전체 CRUD
create policy "admins_all_background_checks"
  on public.background_checks for all
  using (
    get_my_status() = 'active'
    and get_my_role() = 'admin'
  )
  with check (
    get_my_status() = 'active'
    and get_my_role() = 'admin'
  );

-- [SELECT] active 사용자: 자신의 조회 이력만 열람 가능
create policy "users_select_own_background_checks"
  on public.background_checks for select
  using (
    profile_id = auth.uid()
    and get_my_status() = 'active'
  );

-- =============================================
-- Realtime
-- StatusGuard / useAuth의 Realtime 구독이 profiles 변경을 감지할 수 있도록
-- supabase_realtime publication에 테이블 등록
-- =============================================
alter publication supabase_realtime add table public.profiles;
