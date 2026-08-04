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
