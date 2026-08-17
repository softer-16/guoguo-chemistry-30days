begin;

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

create or replace function public.set_course_entitlements_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = pg_catalog.now();
  return new;
end
$function$;

create or replace trigger course_entitlements_set_updated_at
before update on public.course_entitlements
for each row
execute function public.set_course_entitlements_updated_at();

alter table public.course_entitlements enable row level security;

revoke all on public.course_entitlements from anon;
revoke all on public.course_entitlements from authenticated;
grant select on public.course_entitlements to authenticated;

do $migration$
declare
  existing_command text;
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'course_entitlements'
      and policyname <> 'Users can read own course entitlement'
  ) then
    raise exception 'Unexpected existing RLS policy on public.course_entitlements; review it manually before retrying';
  end if;

  select cmd into existing_command
  from pg_policies
  where schemaname = 'public'
    and tablename = 'course_entitlements'
    and policyname = 'Users can read own course entitlement';

  if existing_command is null then
    create policy "Users can read own course entitlement"
    on public.course_entitlements for select
    to authenticated
    using ((select auth.uid()) = user_id);
  elsif upper(existing_command) = 'SELECT' then
    alter policy "Users can read own course entitlement"
    on public.course_entitlements
    to authenticated
    using ((select auth.uid()) = user_id);
  else
    raise exception 'Existing policy "Users can read own course entitlement" is not a SELECT policy';
  end if;
end
$migration$;

commit;
