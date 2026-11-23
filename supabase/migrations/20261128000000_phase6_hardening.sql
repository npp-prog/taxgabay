-- Phase 6 hardening.

-- 1. Receipts: only photos and PDFs, at most 10 MB, enforced by storage itself (not just the page),
--    so an HTML or SVG file cannot be uploaded and opened by the firm.
do $$
begin
  if to_regclass('storage.buckets') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets
    set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
        file_size_limit = 10485760
    where id = 'receipts';
  end if;
end $$;

-- 2. Only the firm's admins can delete a client (and with it every record, TIN and packet).
drop policy "prep_clients: firm write" on public.prep_clients;
create policy "prep_clients: firm insert" on public.prep_clients for insert with check (public.is_firm_member());
create policy "prep_clients: firm update" on public.prep_clients for update using (public.is_firm_member()) with check (public.is_firm_member());
create policy "prep_clients: admin delete" on public.prep_clients for delete using (public.firm_role() = 'admin');

-- 3. Invite codes: at most 10 wrong codes per account per hour.
create table private.claim_failures (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index claim_failures_user_at on private.claim_failures (user_id, at);

create or replace function public.claim_client(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if (select count(*) from private.claim_failures where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many wrong invite codes. Try again in an hour, or ask your CPA for the code.';
  end if;
  select id into cid from public.prep_clients
  where invite_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')) and not archived;
  if cid is null then
    -- Record the failure and return null (raising would roll the record back).
    insert into private.claim_failures (user_id) values (auth.uid());
    return null;
  end if;
  insert into public.client_users (prep_client_id, user_id) values (cid, auth.uid())
  on conflict do nothing;
  return cid;
end;
$$;
revoke execute on function public.claim_client(text) from public, anon;
grant execute on function public.claim_client(text) to authenticated;
