-- Phase 3: issuance library workflow (draft → reviewed → published), enforced in the database.

alter table public.issuances
  add column slug text,
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column needs_verification boolean not null default true,
  add column updated_at timestamptz not null default now();

update public.issuances
  set slug = lower(regexp_replace(
    case type when 'BIR Ruling' then 'bir-ruling' when 'DOF Order' then 'dof-order' when 'CTA/SC decision' then 'court' else type end
    || '-' || number, '[^A-Za-z0-9]+', '-', 'g'));
alter table public.issuances alter column slug set not null;
create unique index issuances_slug on public.issuances (slug);

create or replace function public.issuance_workflow() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  content_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.workflow_state <> 'draft' then
      raise exception 'New issuances must start as drafts';
    end if;
    new.added_by := coalesce(new.added_by, auth.uid());
    new.reviewed_at := null;
    new.reviewed_by := null;
    return new;
  end if;

  new.updated_at := now();
  content_changed := (to_jsonb(new) - array['workflow_state', 'reviewed_at', 'reviewed_by', 'search', 'updated_at'])
                     is distinct from (to_jsonb(old) - array['workflow_state', 'reviewed_at', 'reviewed_by', 'search', 'updated_at']);

  if new.workflow_state is distinct from old.workflow_state then
    if content_changed then
      raise exception 'Save content changes and workflow changes separately';
    end if;
    if not (
      (old.workflow_state = 'draft' and new.workflow_state = 'reviewed') or
      (old.workflow_state = 'reviewed' and new.workflow_state in ('published', 'draft')) or
      (old.workflow_state = 'published' and new.workflow_state = 'draft')
    ) then
      raise exception 'Cannot move an issuance from % to %', old.workflow_state, new.workflow_state;
    end if;
    if new.workflow_state = 'reviewed' then
      if coalesce(btrim(new.summary_plain), '') = '' or new.source_url is null or cardinality(new.tax_types) = 0 then
        raise exception 'A summary, the official source link and at least one tax type are required before review';
      end if;
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    elsif new.workflow_state = 'draft' then
      new.reviewed_at := null;
      new.reviewed_by := null;
    end if;
  elsif content_changed and old.workflow_state <> 'draft' then
    -- Editing a reviewed or published issuance sends it back for review.
    new.workflow_state := 'draft';
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;

create trigger issuances_workflow before insert or update on public.issuances
  for each row execute function public.issuance_workflow();

-- Links are public only when both ends are published.
drop policy "issuance_links: public read" on public.issuance_links;
create policy "issuance_links: public read published" on public.issuance_links for select using (
  public.is_admin() or (
    exists (select 1 from public.issuances i where i.id = from_id and i.workflow_state = 'published') and
    exists (select 1 from public.issuances i where i.id = to_id and i.workflow_state = 'published')
  )
);

create index issuances_tax_types on public.issuances using gin (tax_types);
create index issuances_topics on public.issuances using gin (topics);
