begin;

create table if not exists public.course_contents (
  course_id text primary key,
  content_version text not null,
  payload jsonb not null,
  checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_contents_course_id_check
    check (course_id = 'guoguo-chemistry-30days'),
  constraint course_contents_content_version_check
    check (length(content_version) > 0),
  constraint course_contents_checksum_check
    check (checksum ~ '^[0-9a-f]{64}$')
);

create or replace function public.set_course_contents_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = pg_catalog.now();
  return new;
end
$function$;

drop trigger if exists course_contents_set_updated_at on public.course_contents;
create trigger course_contents_set_updated_at
before update on public.course_contents
for each row
execute function public.set_course_contents_updated_at();

alter table public.course_contents enable row level security;

do $migration$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'course_contents'
      and policyname <> 'Authorized users can read course contents'
  ) then
    raise exception 'Unexpected existing RLS policy on public.course_contents; review it manually before retrying';
  end if;
end
$migration$;

revoke all on public.course_contents from anon;
revoke all on public.course_contents from authenticated;
grant select on public.course_contents to authenticated;

drop policy if exists "Authorized users can read course contents" on public.course_contents;
create policy "Authorized users can read course contents"
on public.course_contents for select
to authenticated
using (
  exists (
    select 1
    from public.course_entitlements as entitlement
    where entitlement.user_id = (select auth.uid())
      and entitlement.course_id = course_contents.course_id
      and entitlement.status = 'active'
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);

commit;
