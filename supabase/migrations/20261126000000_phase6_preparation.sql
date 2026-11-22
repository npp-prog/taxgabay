-- Phase 6: client records in, prepared documents out.
--
-- One firm (Neil Priolo, CPA's). Firm members (preparer, reviewer, admin) see every
-- client of the firm. Client users see only the client(s) they are linked to: they
-- enter records and receipts, and receive packets once the firm releases them.
-- TaxGabay prepares documents; it never files or pays.
--
-- TINs are stored encrypted (pgcrypto, pgp_sym_encrypt) and only after the client has
-- given TIN consent. The key never lives in a table:
--   * Supabase (production): a Vault secret named 'tin_key'
--       select vault.create_secret('<long random key>', 'tin_key');
--   * Plain Postgres (local tests): a setting
--       set app.tin_key = '<key>';   (or alter database ... set app.tin_key = ...)
-- Plaintext TINs are only accepted and returned by the SECURITY DEFINER functions
-- set_tin / get_tin, which check firm membership or client access plus consent.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

-- ---------- Firm members ----------

create table public.firm_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('preparer', 'reviewer', 'admin')),
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.firm_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.firm_members where user_id = auth.uid()),
    case when public.is_admin() then 'admin' end
  );
$$;

create or replace function public.is_firm_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.firm_role() is not null;
$$;

-- ---------- Clients of the firm ----------
-- Separate from public.clients (Phase 4), which are a bookkeeper's private, browser-style
-- profiles. A prep client is a real business the firm prepares documents for.

create table public.prep_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  -- Taxpayer profile (same shape as tax-engine Profile), used to know which documents are due.
  profile jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.client_users (
  prep_client_id uuid not null references public.prep_clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prep_client_id, user_id)
);
create index client_users_user on public.client_users (user_id);

create or replace function public.is_client_user(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.client_users cu where cu.prep_client_id = cid and cu.user_id = auth.uid());
$$;

create or replace function public.can_access_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_firm_member() or public.is_client_user(cid);
$$;

-- ---------- Consents (RA 10173) ----------

create table public.client_consents (
  id uuid primary key default gen_random_uuid(),
  prep_client_id uuid not null references public.prep_clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  consent_type text not null check (consent_type in ('records_storage', 'tin')),
  version text not null,
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index client_consents_client on public.client_consents (prep_client_id, consent_type);

create or replace function public.has_consent(cid uuid, ctype text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.client_consents c
    where c.prep_client_id = cid and c.consent_type = ctype and c.withdrawn_at is null
  );
$$;

-- ---------- Periods ----------

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  prep_client_id uuid not null references public.prep_clients (id) on delete cascade,
  kind text not null check (kind in ('month', 'quarter', 'year')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  status text not null default 'records_incomplete'
    check (status in ('records_incomplete', 'ready', 'prepared', 'reviewed', 'released', 'filed')),
  updated_at timestamptz not null default now(),
  unique (prep_client_id, kind, start_date)
);

-- Clients may only mark records complete (records_incomplete <-> ready) and mark a
-- released period as filed. Everything else is the firm's.
create or replace function public.period_status_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.is_firm_member() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('records_incomplete', 'ready') then
      raise exception 'clients cannot create a period with status %', new.status;
    end if;
    return new;
  end if;
  if new.prep_client_id <> old.prep_client_id or new.kind <> old.kind
     or new.start_date <> old.start_date or new.end_date <> old.end_date then
    raise exception 'clients cannot change the period itself';
  end if;
  if new.status is distinct from old.status and not (
       (old.status in ('records_incomplete', 'ready') and new.status in ('records_incomplete', 'ready'))
    or (old.status = 'released' and new.status = 'filed')
  ) then
    raise exception 'clients cannot change status from % to %', old.status, new.status;
  end if;
  return new;
end;
$$;
create trigger periods_status_guard before insert or update on public.periods
  for each row execute function public.period_status_guard();

-- A record date is locked for clients once a covering period is with the firm or done.
create or replace function public.record_locked(cid uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.periods p
    where p.prep_client_id = cid and d between p.start_date and p.end_date
      and p.status in ('prepared', 'reviewed', 'released', 'filed')
  );
$$;

-- ---------- Records ----------

create table public.records (
  id uuid primary key default gen_random_uuid(),
  prep_client_id uuid not null references public.prep_clients (id) on delete cascade,
  record_date date not null,
  kind text not null check (kind in ('sale', 'expense', 'purchase', 'form_2307_received', 'payroll', 'asset', 'bank_balance', 'other')),
  -- Typed by kind (see packages/filing record types). Never contains a TIN: TINs go in public.tins.
  data jsonb not null default '{}'::jsonb,
  attachment_path text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index records_client_date on public.records (prep_client_id, record_date);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger records_touch before update on public.records for each row execute function public.touch_updated_at();

-- ---------- TINs (encrypted) ----------

create table public.tins (
  id uuid primary key default gen_random_uuid(),
  prep_client_id uuid not null references public.prep_clients (id) on delete cascade,
  subject text not null check (subject in ('client', 'supplier', 'customer', 'employee', 'payor')),
  -- Who the TIN belongs to within the client (supplier or employee name key); '' for the client itself.
  subject_ref text not null default '',
  tin_encrypted bytea not null,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (prep_client_id, subject, subject_ref)
);
-- RLS on and no policies: the table is reachable only through the functions below.

create or replace function private.tin_key() returns text
language plpgsql stable security definer set search_path = public as $$
declare k text;
begin
  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into k using 'tin_key';
  end if;
  k := coalesce(k, nullif(current_setting('app.tin_key', true), ''));
  if k is null or length(k) < 16 then
    raise exception 'TIN encryption key is not configured';
  end if;
  return k;
end;
$$;
revoke all on function private.tin_key() from public;

create or replace function private.tin_guard(cid uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_access_client(cid) then
    raise exception 'not allowed';
  end if;
  if not public.has_consent(cid, 'tin') then
    raise exception 'TIN consent has not been given for this client';
  end if;
end;
$$;
revoke all on function private.tin_guard(uuid) from public;

create or replace function public.set_tin(cid uuid, subj text, ref text, tin text) returns void
language plpgsql security definer set search_path = public as $$
declare digits text := regexp_replace(coalesce(tin, ''), '[^0-9]', '', 'g');
begin
  perform private.tin_guard(cid);
  if length(digits) not between 9 and 14 then
    raise exception 'A TIN has 9 to 14 digits';
  end if;
  insert into public.tins (prep_client_id, subject, subject_ref, tin_encrypted, last4)
  values (cid, subj, coalesce(ref, ''), pgp_sym_encrypt(digits, private.tin_key()), right(digits, 4))
  on conflict (prep_client_id, subject, subject_ref) do update
    set tin_encrypted = excluded.tin_encrypted, last4 = excluded.last4, updated_by = auth.uid(), updated_at = now();
  insert into public.admin_audit_log (table_name, row_pk, action, new_row)
  values ('tins', cid::text || ':' || subj || ':' || coalesce(ref, ''), 'UPDATE', jsonb_build_object('last4', right(digits, 4)));
end;
$$;

create or replace function public.get_tin(cid uuid, subj text, ref text) returns text
language plpgsql security definer set search_path = public as $$
declare enc bytea;
begin
  perform private.tin_guard(cid);
  select tin_encrypted into enc from public.tins where prep_client_id = cid and subject = subj and subject_ref = coalesce(ref, '');
  if enc is null then
    return null;
  end if;
  return pgp_sym_decrypt(enc, private.tin_key());
end;
$$;

-- Masked list (last 4 digits), for showing which TINs are on file.
create or replace function public.list_tins(cid uuid) returns table (subject text, subject_ref text, last4 text, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform private.tin_guard(cid);
  return query select t.subject, t.subject_ref, t.last4, t.updated_at from public.tins t where t.prep_client_id = cid order by 1, 2;
end;
$$;

create or replace function public.delete_tin(cid uuid, subj text, ref text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_access_client(cid) then
    raise exception 'not allowed';
  end if;
  delete from public.tins where prep_client_id = cid and subject = subj and subject_ref = coalesce(ref, '');
end;
$$;

-- Withdrawing TIN consent erases the client's TINs.
create or replace function public.consent_withdrawn() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.consent_type = 'tin' and new.withdrawn_at is not null and old.withdrawn_at is null
     and not public.has_consent(new.prep_client_id, 'tin') then
    delete from public.tins where prep_client_id = new.prep_client_id;
  end if;
  return new;
end;
$$;
create trigger client_consents_withdrawn after update on public.client_consents
  for each row execute function public.consent_withdrawn();

revoke all on function public.set_tin(uuid, text, text, text), public.get_tin(uuid, text, text),
  public.list_tins(uuid), public.delete_tin(uuid, text, text) from public;
grant execute on function public.set_tin(uuid, text, text, text), public.get_tin(uuid, text, text),
  public.list_tins(uuid), public.delete_tin(uuid, text, text) to authenticated;

-- ---------- Packets (prepared documents) ----------

create table public.packets (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  prep_client_id uuid not null references public.prep_clients (id) on delete cascade,
  -- Prepared documents with values, steps and warnings (packages/filing output).
  -- Never put TINs in the payload (it is copied to the audit log): fetch them with get_tin
  -- when rendering the PDF.
  payload jsonb not null,
  status text not null default 'prepared' check (status in ('prepared', 'reviewed', 'released')),
  prepared_by uuid references auth.users (id) on delete set null default auth.uid(),
  prepared_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  released_at timestamptz,
  watermark text generated always as (case when status = 'prepared' then 'Draft — not reviewed' end) stored
);
create index packets_period on public.packets (period_id);

-- Review needs a reviewer or admin; release needs a reviewed packet. Reviewer and
-- timestamps are set here, not by the caller.
create or replace function public.packet_workflow() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := public.firm_role();
begin
  if r is null then
    raise exception 'only the firm can prepare, review or release packets';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'prepared' then
      raise exception 'a new packet starts as prepared';
    end if;
    new.prepared_by := auth.uid();
    new.prepared_at := now();
    new.reviewed_by := null; new.reviewed_at := null; new.released_at := null;
    return new;
  end if;
  if new.payload is distinct from old.payload and old.status <> 'prepared' then
    raise exception 'a reviewed or released packet cannot be changed; prepare a new one';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if new.status = 'reviewed' then
    if old.status <> 'prepared' or r not in ('reviewer', 'admin') then
      raise exception 'only a reviewer can review a prepared packet';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  elsif new.status = 'released' then
    if old.status <> 'reviewed' then
      raise exception 'a packet must be reviewed before it is released';
    end if;
    new.released_at := now();
  elsif new.status = 'prepared' then
    if old.status = 'released' then
      raise exception 'a released packet cannot be withdrawn; prepare a new one';
    end if;
    new.reviewed_by := null; new.reviewed_at := null;
  end if;
  return new;
end;
$$;
create trigger packets_workflow before insert or update on public.packets
  for each row execute function public.packet_workflow();
create trigger packets_audit after insert or update or delete on public.packets
  for each row execute function public.audit_row();
create trigger periods_audit after update or delete on public.periods
  for each row execute function public.audit_row();

-- ---------- Row Level Security ----------

alter table public.firm_members enable row level security;
alter table public.prep_clients enable row level security;
alter table public.client_users enable row level security;
alter table public.client_consents enable row level security;
alter table public.periods enable row level security;
alter table public.records enable row level security;
alter table public.tins enable row level security;
alter table public.packets enable row level security;

create policy "firm_members: firm read" on public.firm_members for select using (public.is_firm_member());
create policy "firm_members: admin write" on public.firm_members for all
  using (public.firm_role() = 'admin') with check (public.firm_role() = 'admin');

create policy "prep_clients: read" on public.prep_clients for select using (public.can_access_client(id));
create policy "prep_clients: firm write" on public.prep_clients for all using (public.is_firm_member()) with check (public.is_firm_member());

create policy "client_users: read" on public.client_users for select using (public.is_firm_member() or user_id = auth.uid());
create policy "client_users: firm write" on public.client_users for all using (public.is_firm_member()) with check (public.is_firm_member());

create policy "client_consents: read" on public.client_consents for select using (public.can_access_client(prep_client_id));
create policy "client_consents: client gives" on public.client_consents for insert
  with check (user_id = auth.uid() and public.is_client_user(prep_client_id));
create policy "client_consents: client withdraws" on public.client_consents for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_client_user(prep_client_id));

create policy "periods: read" on public.periods for select using (public.can_access_client(prep_client_id));
create policy "periods: write" on public.periods for insert with check (public.can_access_client(prep_client_id));
create policy "periods: update" on public.periods for update
  using (public.can_access_client(prep_client_id)) with check (public.can_access_client(prep_client_id));
create policy "periods: firm delete" on public.periods for delete using (public.is_firm_member());

-- Clients add and edit their own records (after consenting to storage) while the period is open.
create policy "records: read" on public.records for select using (public.can_access_client(prep_client_id));
create policy "records: firm write" on public.records for all using (public.is_firm_member()) with check (public.is_firm_member());
create policy "records: client insert" on public.records for insert with check (
  public.is_client_user(prep_client_id) and public.has_consent(prep_client_id, 'records_storage')
  and not public.record_locked(prep_client_id, record_date));
create policy "records: client update" on public.records for update
  using (public.is_client_user(prep_client_id) and not public.record_locked(prep_client_id, record_date))
  with check (public.is_client_user(prep_client_id) and not public.record_locked(prep_client_id, record_date));
create policy "records: client delete" on public.records for delete
  using (public.is_client_user(prep_client_id) and not public.record_locked(prep_client_id, record_date));

-- Clients see a packet only once it is released; the firm sees all and writes (the trigger enforces roles).
create policy "packets: firm all" on public.packets for all using (public.is_firm_member()) with check (public.is_firm_member());
create policy "packets: client read released" on public.packets for select
  using (status = 'released' and public.is_client_user(prep_client_id));

-- The firm's admins can read the audit trail of packets, periods and TIN changes.
create policy "audit: firm admin read phase6" on public.admin_audit_log for select
  using (public.firm_role() = 'admin' and table_name in ('packets', 'periods', 'tins'));

-- ---------- Receipts storage ----------

create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;
-- Private bucket; objects live under '<prep_client_id>/...'.

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
    execute $p$create policy "receipts: read" on storage.objects for select
      using (bucket_id = 'receipts' and public.can_access_client(public.try_uuid((storage.foldername(name))[1])))$p$;
    execute $p$create policy "receipts: upload" on storage.objects for insert
      with check (bucket_id = 'receipts' and public.can_access_client(public.try_uuid((storage.foldername(name))[1]))
        and (public.is_firm_member() or public.has_consent(public.try_uuid((storage.foldername(name))[1]), 'records_storage')))$p$;
    execute $p$create policy "receipts: delete" on storage.objects for delete
      using (bucket_id = 'receipts' and public.can_access_client(public.try_uuid((storage.foldername(name))[1])))$p$;
  end if;
end $$;
