-- TaxGabay initial schema (Phase 1).
-- Reference data: public read, admin write, every change audited.
-- User data: Row Level Security, owner-only.

create extension if not exists pgcrypto;

-- ---------- Helpers ----------

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_pk text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_row jsonb,
  new_row jsonb,
  actor uuid default auth.uid(),
  at timestamptz not null default now()
);

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pk text;
begin
  pk := coalesce(
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'code',
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'date'
  );
  insert into public.admin_audit_log (table_name, row_pk, action, old_row, new_row)
  values (
    tg_table_name, coalesce(pk, '?'), tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- ---------- Reference data ----------

create table public.tax_rules (
  id text primary key,
  rule_key text not null,
  tax_type text not null,
  taxpayer_category text not null,
  value_json jsonb not null,
  effective_from date not null,
  effective_to date,
  legal_basis text not null,
  source_url text,
  last_verified_at date,
  needs_verification boolean not null default true,
  note text,
  check (effective_to is null or effective_to >= effective_from)
);
create index tax_rules_lookup on public.tax_rules (rule_key, taxpayer_category, effective_from);

create table public.deadline_rules (
  id text primary key,
  form_code text not null,
  title text not null,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'annual', 'one_time', 'event')),
  due_logic_json jsonb not null,
  applies_when_json jsonb not null,
  filing_channel text not null default 'all',
  effective_from date not null,
  effective_to date,
  legal_basis text not null,
  source_url text,
  last_verified_at date,
  needs_verification boolean not null default true,
  note text
);

create table public.holidays (
  date date primary key,
  name text not null,
  type text not null check (type in ('regular', 'special_non_working')),
  year int not null,
  legal_basis text not null,
  needs_verification boolean not null default true,
  note text
);

create table public.deadline_extensions (
  id uuid primary key default gen_random_uuid(),
  form_code text not null,
  original_date date not null,
  new_date date not null,
  issuance_ref text not null
);

create table public.forms (
  code text primary key,
  name text not null,
  description text not null,
  who_files text not null,
  frequency text not null,
  attachments_json jsonb not null default '[]',
  filing_channels text[] not null default '{}',
  guide_slug text,
  needs_verification boolean not null default true
);

create table public.issuances (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('RR', 'RMO', 'RMC', 'RAMO', 'BIR Ruling', 'DOF Order', 'RA', 'EO', 'CTA/SC decision', 'SEC', 'LGU')),
  number text not null,
  title text not null,
  date_issued date,
  effectivity_date date,
  tax_types text[] not null default '{}',
  topics text[] not null default '{}',
  summary_plain text,
  status text not null default 'active' check (status in ('active', 'amended', 'revoked', 'superseded')),
  workflow_state text not null default 'draft' check (workflow_state in ('draft', 'reviewed', 'published')),
  source_url text,
  pdf_path text,
  added_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  search tsvector generated always as (
    to_tsvector('english', coalesce(number, '') || ' ' || coalesce(title, '') || ' ' || coalesce(summary_plain, ''))
  ) stored,
  unique (type, number)
);
create index issuances_search on public.issuances using gin (search);

create table public.issuance_links (
  from_id uuid not null references public.issuances (id) on delete cascade,
  to_id uuid not null references public.issuances (id) on delete cascade,
  relation text not null check (relation in ('amends', 'revokes', 'implements', 'clarifies')),
  primary key (from_id, to_id, relation)
);

create table public.registration_steps (
  id text primary key,
  business_form text not null check (business_form in ('dti', 'sec', 'cda')),
  "order" int not null,
  agency text not null,
  title text not null,
  summary text not null,
  requirements_json jsonb not null default '[]',
  "where" text,
  online_link text,
  fees_note text,
  est_days text,
  legal_basis text not null,
  only_if_employees boolean not null default false,
  needs_verification boolean not null default true
);

create table public.checklist_templates (
  id text primary key,
  title text not null,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'annual', 'one_time'))
);

create table public.checklist_items (
  id text primary key,
  template_id text not null references public.checklist_templates (id) on delete cascade,
  title text not null,
  frequency text not null,
  applies_when_json jsonb not null default '{}',
  form_code text references public.forms (code)
);

-- ---------- User data ----------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  taxpayer_type text not null,
  business_form text,
  vat_status text not null,
  income_tax_option text not null,
  has_employees boolean not null default false,
  withholds_expanded boolean not null default false,
  filing_channel text not null,
  efps_group text check (efps_group in ('A', 'B', 'C', 'D', 'E')),
  fiscal_year_end_month int not null default 12 check (fiscal_year_end_month between 1 and 12),
  rdo_code text,
  taxpayer_size text not null,
  line_of_business text,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_obligations (
  user_id uuid not null references auth.users (id) on delete cascade,
  obligation_id text not null, -- "<deadline_rule_id>:<period_end>"
  deadline_rule_id text not null references public.deadline_rules (id),
  period text not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'filed', 'paid', 'filed_and_paid')),
  completed_at timestamptz,
  primary key (user_id, obligation_id)
);

create table public.user_roadmap_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  step_id text not null references public.registration_steps (id),
  done_at timestamptz not null default now(),
  primary key (user_id, step_id)
);

create table public.user_checklist_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  checklist_item_id text not null references public.checklist_items (id),
  period text not null,
  done_at timestamptz not null default now(),
  primary key (user_id, checklist_item_id, period)
);

create table public.saved_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calculator text not null,
  input_json jsonb not null,
  result_json jsonb not null,
  created_at timestamptz not null default now()
);

create table public.reminder_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  days_before int[] not null default '{7,3,1}',
  email_enabled boolean not null default true,
  push_enabled boolean not null default false
);

create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

-- ---------- RLS: reference tables (public read, admin write) ----------

do $$
declare t text;
begin
  foreach t in array array['tax_rules', 'deadline_rules', 'holidays', 'deadline_extensions', 'forms',
                           'issuance_links', 'registration_steps', 'checklist_templates', 'checklist_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: public read" on public.%I for select using (true)', t, t);
    execute format('create policy "%s: admin write" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end $$;

-- Issuances: only published rows are public.
alter table public.issuances enable row level security;
create policy "issuances: public read published" on public.issuances for select using (workflow_state = 'published' or public.is_admin());
create policy "issuances: admin write" on public.issuances for all using (public.is_admin()) with check (public.is_admin());
create trigger issuances_audit after insert or update or delete on public.issuances for each row execute function public.audit_row();

alter table public.admin_audit_log enable row level security;
create policy "audit: admin read" on public.admin_audit_log for select using (public.is_admin());

-- ---------- RLS: user tables (owner only) ----------

do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_obligations', 'user_roadmap_progress', 'user_checklist_progress',
                           'saved_calculations', 'reminder_settings', 'bookmarks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: owner" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- ---------- Account deletion (RA 10173) ----------

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid(); -- user tables cascade
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
