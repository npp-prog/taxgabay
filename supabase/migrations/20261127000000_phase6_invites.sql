-- Phase 6: invite codes. The firm creates a client and gives the code to the client, who
-- enters it once after signing in; that links their account to the business.

create or replace function private.new_invite_code() returns text
language sql volatile as $$
  -- 10 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 10);
$$;

alter table public.prep_clients
  add column invite_code text unique default private.new_invite_code();

-- Clients can read their client row (existing policy) but must not learn other codes;
-- the code is only useful before linking, so exposing it to linked users is harmless.

create or replace function public.claim_client(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  select id into cid from public.prep_clients
  where invite_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')) and not archived;
  if cid is null then
    raise exception 'That invite code is not valid. Check it with your CPA.';
  end if;
  insert into public.client_users (prep_client_id, user_id) values (cid, auth.uid())
  on conflict do nothing;
  return cid;
end;
$$;

-- The firm can issue a fresh code (for example after a client's staff member leaves).
create or replace function public.reset_invite_code(cid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text := private.new_invite_code();
begin
  if not public.is_firm_member() then
    raise exception 'only the firm can reset invite codes';
  end if;
  update public.prep_clients set invite_code = c where id = cid;
  return c;
end;
$$;

revoke execute on function public.claim_client(text) from public, anon;
revoke execute on function public.reset_invite_code(uuid) from public, anon;
grant execute on function public.claim_client(text) to authenticated;
grant execute on function public.reset_invite_code(uuid) to authenticated;
