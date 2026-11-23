-- Hardening tests. Run after phase6_rls.sql and phase6_invites.sql in the same session.
create function pg_temp.check3(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

select pg_temp.check3((select allowed_mime_types from storage.buckets where id = 'receipts') = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] and (select file_size_limit from storage.buckets where id = 'receipts') = 10485760, 'receipts accept only photos and PDFs up to 10 MB');

-- A preparer cannot delete a client; the admin can.
insert into public.prep_clients (id, name) values ('33333333-3333-3333-3333-333333333333', 'Client Three');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
set role authenticated;
delete from public.prep_clients where id = '33333333-3333-3333-3333-333333333333';
reset role;
select pg_temp.check3((select count(*) from public.prep_clients where id = '33333333-3333-3333-3333-333333333333') = 1, 'a preparer cannot delete a client');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
set role authenticated;
delete from public.prep_clients where id = '33333333-3333-3333-3333-333333333333';
update public.prep_clients set name = 'Client One (renamed)' where id = '11111111-1111-1111-1111-111111111111';
reset role;
select pg_temp.check3((select count(*) from public.prep_clients where id = '33333333-3333-3333-3333-333333333333') = 0, 'the firm admin can delete a client');
select pg_temp.check3((select name from public.prep_clients where id = '11111111-1111-1111-1111-111111111111') = 'Client One (renamed)', 'the firm can still edit clients');

-- Wrong invite codes: null (recorded), then locked out after 10 in an hour.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c4');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4"}', false);
set role authenticated;
select pg_temp.check3(public.claim_client('WRONGCODE1') is null, 'a wrong invite code returns nothing');
select public.claim_client('WRONGCODE' || g) from generate_series(2, 10) g;
do $$ begin
  perform public.claim_client('WRONGCODE11');
  raise exception 'FAILED: no lockout';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: after 10 wrong codes in an hour the account is locked out';
end $$;
reset role;
\echo 'PHASE 6 HARDENING: ALL CHECKS PASSED'
