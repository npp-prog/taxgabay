-- Invite-code tests. Run after phase6_rls.sql (reuses its fixtures and helpers in the same session):
--   psql ... -f supabase/tests/phase6_rls.sql -f supabase/tests/phase6_invites.sql
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c3');
create function pg_temp.check2(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

select pg_temp.check2((select count(distinct invite_code) from public.prep_clients) = 2 and (select bool_and(length(invite_code) = 10) from public.prep_clients), 'every client gets a unique 10-character invite code');

-- A new user with no link sees nothing, then claims client 1 with a lower-case, spaced code.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', false);
set role authenticated;
select pg_temp.check2((select count(*) from public.prep_clients) = 0, 'an unlinked user sees no clients');
select pg_temp.check2(public.claim_client('nope') is null, 'a wrong invite code is refused');
reset role;
select set_config('app.code1', (select lower(substr(invite_code, 1, 5) || ' ' || substr(invite_code, 6)) from public.prep_clients where id = '11111111-1111-1111-1111-111111111111'), false);
set role authenticated;
select pg_temp.check2(public.claim_client(current_setting('app.code1')) = '11111111-1111-1111-1111-111111111111', 'claiming a code links the user to that client');
select pg_temp.check2((select count(*) from public.prep_clients) = 1, 'after claiming, the user sees only that client');
do $$ begin
  perform public.reset_invite_code('11111111-1111-1111-1111-111111111111');
  raise exception 'FAILED: client reset a code';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: a client cannot reset invite codes';
end $$;
reset role;

-- The firm resets the code; the old one stops working.
select set_config('app.old', (select invite_code from public.prep_clients where id = '11111111-1111-1111-1111-111111111111'), false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
set role authenticated;
select pg_temp.check2(public.reset_invite_code('11111111-1111-1111-1111-111111111111') <> current_setting('app.old'), 'the firm can issue a fresh code');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', false);
set role authenticated;
select pg_temp.check2(public.claim_client(current_setting('app.old')) is null, 'the old code no longer works');
reset role;
\echo 'PHASE 6 INVITES: ALL CHECKS PASSED'
