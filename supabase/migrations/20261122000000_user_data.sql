create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sets jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sets) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

revoke all on table public.user_data from anon, authenticated;
grant select, insert, update, delete on table public.user_data to authenticated;

create policy "Users can read their own data"
  on public.user_data for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own data"
  on public.user_data for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own data"
  on public.user_data for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own data"
  on public.user_data for delete
  to authenticated
  using ((select auth.uid()) = user_id);
