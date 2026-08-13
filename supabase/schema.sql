create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

drop policy if exists "Users can read own progress" on public.user_progress;
drop policy if exists "Users can insert own progress" on public.user_progress;
drop policy if exists "Users can update own progress" on public.user_progress;

create policy "Users can read own progress"
on public.user_progress for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own progress"
on public.user_progress for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own progress"
on public.user_progress for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_progress to authenticated;
revoke all on public.user_progress from anon;

create table if not exists public.course_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  status text not null default 'active',
  plan_start_date date not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id),
  constraint course_entitlements_course_id_check
    check (course_id = 'guoguo-chemistry-30days'),
  constraint course_entitlements_status_check
    check (status in ('active', 'suspended', 'revoked'))
);

alter table public.course_entitlements enable row level security;

drop policy if exists "Users can read own course entitlement" on public.course_entitlements;

create policy "Users can read own course entitlement"
on public.course_entitlements for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.course_entitlements from anon;
revoke all on public.course_entitlements from authenticated;
grant select on public.course_entitlements to authenticated;
