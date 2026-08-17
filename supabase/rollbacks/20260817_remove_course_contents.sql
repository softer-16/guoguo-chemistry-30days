-- 仅在前端已回滚且经负责人明确确认后执行。
begin;

drop policy if exists "Authorized users can read course contents" on public.course_contents;
drop trigger if exists course_contents_set_updated_at on public.course_contents;
drop function if exists public.set_course_contents_updated_at();
drop table if exists public.course_contents;

commit;
