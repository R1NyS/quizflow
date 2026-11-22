alter table public.user_data
  add column if not exists study_stats jsonb not null
  default '{"dailyGoal":20,"dailyHistory":{}}'::jsonb;

create table if not exists public.shared_sets (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  allow_edit boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_set_members (
  shared_set_id uuid not null references public.shared_sets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (shared_set_id, user_id)
);

create or replace function public.prevent_shared_set_owner_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'The owner of a shared set cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists shared_set_owner_immutable on public.shared_sets;
create trigger shared_set_owner_immutable
  before update on public.shared_sets
  for each row execute function public.prevent_shared_set_owner_change();

alter table public.shared_sets enable row level security;
alter table public.shared_set_members enable row level security;

revoke all on public.shared_sets, public.shared_set_members from anon, authenticated;
grant select, delete on public.shared_sets to authenticated;
grant insert (invite_code, owner_id, title, payload, allow_edit) on public.shared_sets to authenticated;
grant update (title, payload, updated_at) on public.shared_sets to authenticated;
grant select on public.shared_set_members to authenticated;

drop policy if exists "Members can read shared sets" on public.shared_sets;
create policy "Members can read shared sets"
  on public.shared_sets for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.shared_set_members member
      where member.shared_set_id = id and member.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can create shared sets" on public.shared_sets;
create policy "Users can create shared sets"
  on public.shared_sets for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners and editors can update shared sets" on public.shared_sets;
create policy "Owners and editors can update shared sets"
  on public.shared_sets for update to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.shared_set_members member
      where member.shared_set_id = id and member.user_id = (select auth.uid()) and member.role = 'editor'
    )
  )
  with check (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.shared_set_members member
      where member.shared_set_id = id and member.user_id = (select auth.uid()) and member.role = 'editor'
    )
  );

drop policy if exists "Only owners can delete shared sets" on public.shared_sets;
create policy "Only owners can delete shared sets"
  on public.shared_sets for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Users can read their memberships" on public.shared_set_members;
create policy "Users can read their memberships"
  on public.shared_set_members for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.join_shared_set(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  shared_row public.shared_sets%rowtype;
  member_role text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join a shared set';
  end if;

  select * into shared_row
  from public.shared_sets
  where invite_code = p_invite_code;

  if not found then
    raise exception 'This invitation link is invalid or expired';
  end if;

  if shared_row.owner_id = auth.uid() then
    member_role := 'owner';
  else
    member_role := case when shared_row.allow_edit then 'editor' else 'viewer' end;
    insert into public.shared_set_members (shared_set_id, user_id, role)
    values (shared_row.id, auth.uid(), member_role)
    on conflict (shared_set_id, user_id) do update set role = excluded.role;
  end if;

  return jsonb_build_object(
    'shared_set_id', shared_row.id,
    'title', shared_row.title,
    'payload', shared_row.payload,
    'role', member_role
  );
end;
$$;

revoke all on function public.join_shared_set(text) from public, anon;
grant execute on function public.join_shared_set(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_sets'
  ) then
    alter publication supabase_realtime add table public.shared_sets;
  end if;
end;
$$;

alter table public.shared_sets replica identity full;
