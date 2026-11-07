-- Run in Supabase SQL Editor. Private per-user workout sessions.
create table if not exists public.workout_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  session jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.workout_sessions enable row level security;
revoke all on public.workout_sessions from anon;
grant select, insert, update, delete on public.workout_sessions to authenticated;
drop policy if exists "Read own workouts" on public.workout_sessions;
create policy "Read own workouts" on public.workout_sessions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own workouts" on public.workout_sessions;
create policy "Insert own workouts" on public.workout_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own workouts" on public.workout_sessions;
create policy "Update own workouts" on public.workout_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own workouts" on public.workout_sessions;
create policy "Delete own workouts" on public.workout_sessions for delete to authenticated using ((select auth.uid()) = user_id);
