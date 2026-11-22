-- Phase 4: multi-client mode (bookkeepers).
--
-- A user can keep several taxpayer profiles ("clients"). Rows with client_id = NULL
-- belong to the user's default client — every row written before this migration is
-- therefore the default client's, and nothing needs to be moved.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index clients_user on public.clients (user_id);
alter table public.clients enable row level security;
create policy "clients: owner" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Is this client one of the current user's (or the default client)?
create or replace function public.owns_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select cid is null or exists (select 1 from public.clients c where c.id = cid and c.user_id = auth.uid());
$$;

-- profiles: one row per (user, client).
alter table public.profiles drop constraint profiles_pkey;
alter table public.profiles add column id uuid not null default gen_random_uuid() primary key;
alter table public.profiles add column client_id uuid references public.clients (id) on delete cascade;
alter table public.profiles add constraint profiles_user_client unique nulls not distinct (user_id, client_id);

-- user_obligations: one row per (user, client, obligation).
alter table public.user_obligations drop constraint user_obligations_pkey;
alter table public.user_obligations add column id uuid not null default gen_random_uuid() primary key;
alter table public.user_obligations add column client_id uuid references public.clients (id) on delete cascade;
alter table public.user_obligations add constraint user_obligations_user_client_obligation unique nulls not distinct (user_id, client_id, obligation_id);

-- user_roadmap_progress: one row per (user, client, step).
alter table public.user_roadmap_progress drop constraint user_roadmap_progress_pkey;
alter table public.user_roadmap_progress add column id uuid not null default gen_random_uuid() primary key;
alter table public.user_roadmap_progress add column client_id uuid references public.clients (id) on delete cascade;
alter table public.user_roadmap_progress add constraint user_roadmap_progress_user_client_step unique nulls not distinct (user_id, client_id, step_id);

-- user_checklist_progress: one row per (user, client, item, period).
alter table public.user_checklist_progress drop constraint user_checklist_progress_pkey;
alter table public.user_checklist_progress add column id uuid not null default gen_random_uuid() primary key;
alter table public.user_checklist_progress add column client_id uuid references public.clients (id) on delete cascade;
alter table public.user_checklist_progress add constraint user_checklist_progress_user_client_item unique nulls not distinct (user_id, client_id, checklist_item_id, period);

-- Owner policies now also require that a referenced client belongs to the same user,
-- so nobody can attach rows to another user's client id.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_obligations', 'user_roadmap_progress', 'user_checklist_progress']
  loop
    execute format('drop policy "%s: owner" on public.%I', t, t);
    execute format(
      'create policy "%s: owner" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id and public.owns_client(client_id))',
      t, t);
  end loop;
end $$;
