-- Phase 6 RLS tests. Run on a fresh database after stub_supabase.sql and all migrations:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/stub_supabase.sql -f supabase/migrations/*.sql -f supabase/tests/phase6_rls.sql
-- Every check raises an exception on failure, so the script stops at the first broken rule.

grant usage on schema public, auth, storage to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema storage to authenticated;
grant execute on all functions in schema public, auth, storage to authenticated;
set app.tin_key = 'test-key-0123456789abcdef';

-- Fixtures (as the table owner, RLS bypassed).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), -- Neil (firm admin / reviewer)
  ('00000000-0000-0000-0000-00000000000b'), -- staff preparer
  ('00000000-0000-0000-0000-0000000000c1'), -- client user of client 1
  ('00000000-0000-0000-0000-0000000000c2'); -- client user of client 2
insert into public.firm_members (user_id, role, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'Neil Priolo, CPA'),
  ('00000000-0000-0000-0000-00000000000b', 'preparer', 'Staff');
insert into public.prep_clients (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Client One'),
  ('22222222-2222-2222-2222-222222222222', 'Client Two');
insert into public.client_users (prep_client_id, user_id) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000c1'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000c2');
insert into public.client_consents (prep_client_id, user_id, consent_type, version) values
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000c2', 'records_storage', '2026-11'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000c2', 'tin', '2026-11');
insert into public.periods (id, prep_client_id, kind, start_date, end_date) values
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'quarter', '2026-01-01', '2026-03-31'),
  ('a2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'quarter', '2026-01-01', '2026-03-31');
insert into public.records (prep_client_id, record_date, kind, data) values
  ('11111111-1111-1111-1111-111111111111', '2026-01-10', 'sale', '{"amount":"1000.00"}'),
  ('22222222-2222-2222-2222-222222222222', '2026-01-11', 'sale', '{"amount":"2000.00"}');

-- Helper: run as a given user.
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, false);
end $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pg_temp.raises(stmt text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok: % (%)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED (no error): %', what;
end $$;

-- ===== Firm prepares a packet for client 2 while client 2 is outside =====
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
insert into public.packets (period_id, prep_client_id, payload)
  values ('a2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '{"documents":[]}');
insert into public.packets (period_id, prep_client_id, payload)
  values ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '{"documents":[]}');
select pg_temp.check((select count(*) from public.records) = 2, 'firm preparer reads every client''s records');
select pg_temp.check((select watermark from public.packets where prep_client_id = '22222222-2222-2222-2222-222222222222') = 'Draft — not reviewed', 'new packet is watermarked as draft');
select pg_temp.raises($$update public.packets set status = 'reviewed' where prep_client_id = '22222222-2222-2222-2222-222222222222'$$, 'a preparer cannot review');
select pg_temp.raises($$update public.packets set status = 'released' where prep_client_id = '22222222-2222-2222-2222-222222222222'$$, 'cannot release before review');
reset role;

-- ===== Client 1 =====
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select pg_temp.check((select count(*) from public.prep_clients) = 1, 'client 1 sees only its own client');
select pg_temp.check((select count(*) from public.records) = 1, 'client 1 cannot read client 2''s records');
select pg_temp.check(not exists (select 1 from public.records where prep_client_id = '22222222-2222-2222-2222-222222222222'), 'no client 2 records leak to client 1');
select pg_temp.check((select count(*) from public.packets) = 0, 'client 1 sees no unreleased packets, and none of client 2''s');
select pg_temp.raises($$insert into public.records (prep_client_id, record_date, kind) values ('11111111-1111-1111-1111-111111111111', '2026-02-01', 'expense')$$, 'client cannot add records before consenting to storage');
select pg_temp.raises($$insert into public.records (prep_client_id, record_date, kind) values ('22222222-2222-2222-2222-222222222222', '2026-02-01', 'expense')$$, 'client 1 cannot add records to client 2');
select pg_temp.raises($$select public.get_tin('22222222-2222-2222-2222-222222222222', 'client', '')$$, 'client 1 cannot read client 2''s TIN');
select pg_temp.raises($$select public.set_tin('11111111-1111-1111-1111-111111111111', 'client', '', '123-456-789-000')$$, 'TIN refused without TIN consent');
select pg_temp.check((select count(*) from public.tins) = 0, 'tins table is not readable directly');
insert into public.client_consents (prep_client_id, consent_type, version) values ('11111111-1111-1111-1111-111111111111', 'records_storage', '2026-11');
insert into public.records (prep_client_id, record_date, kind, data) values ('11111111-1111-1111-1111-111111111111', '2026-02-01', 'expense', '{"amount":"500.00"}');
select pg_temp.check((select count(*) from public.records) = 2, 'client 1 adds a record after consenting');
update public.periods set status = 'ready' where id = 'a1111111-0000-0000-0000-000000000001';
select pg_temp.raises($$update public.periods set status = 'released' where id = 'a1111111-0000-0000-0000-000000000001'$$, 'client cannot release its own period');
select pg_temp.check((select count(*) from public.packets where status in ('reviewed','released')) = 0, 'still nothing visible');
-- A client cannot touch packets at all (only released ones are even visible).
update public.packets set status = 'released';
select pg_temp.check((select count(*) from public.packets) = 0, 'client update on packets affects nothing');
select pg_temp.raises($$insert into storage.objects (bucket_id, name) values ('receipts', '22222222-2222-2222-2222-222222222222/r.jpg')$$, 'client 1 cannot upload into client 2''s receipts folder');
insert into storage.objects (bucket_id, name) values ('receipts', '11111111-1111-1111-1111-111111111111/r.jpg');
reset role;

-- ===== Client 2 sets its TIN (consented) =====
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
set role authenticated;
select public.set_tin('22222222-2222-2222-2222-222222222222', 'client', '', '123-456-789-000');
select pg_temp.check(public.get_tin('22222222-2222-2222-2222-222222222222', 'client', '') = '123456789000', 'client 2 reads back its own TIN');
select pg_temp.check((select last4 from public.list_tins('22222222-2222-2222-2222-222222222222')) = '9000', 'masked list shows last 4 digits');
select pg_temp.check((select count(*) from storage.objects) = 0, 'client 2 cannot see client 1''s receipts');
reset role;
select pg_temp.check((select position('123456789' in encode(tin_encrypted, 'escape')) = 0 from public.tins), 'TIN is stored encrypted, not in plaintext');
select pg_temp.check(not exists (select 1 from public.admin_audit_log where table_name = 'tins' and new_row::text like '%123456789%'), 'audit log never holds the full TIN');

-- ===== Neil reviews and releases client 2's packet =====
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update public.packets set status = 'reviewed' where prep_client_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.check((select reviewed_by from public.packets where prep_client_id = '22222222-2222-2222-2222-222222222222') = '00000000-0000-0000-0000-00000000000a', 'reviewer is recorded');
select pg_temp.check((select watermark from public.packets where prep_client_id = '22222222-2222-2222-2222-222222222222') is null, 'reviewed packet has no draft watermark');
update public.packets set status = 'released' where prep_client_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.raises($$update public.packets set payload = '{}' where prep_client_id = '22222222-2222-2222-2222-222222222222'$$, 'released packet cannot be edited');
select pg_temp.check(public.get_tin('22222222-2222-2222-2222-222222222222', 'client', '') = '123456789000', 'firm reads a consented TIN');
select pg_temp.check((select count(*) from storage.objects) = 1, 'firm sees all receipts');
select pg_temp.check((select count(*) from public.admin_audit_log where table_name = 'packets') >= 3, 'packet workflow is audited and readable by the firm admin');
reset role;

-- ===== Clients after release =====
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
set role authenticated;
select pg_temp.check((select count(*) from public.packets) = 1, 'client 2 sees its released packet');
reset role;
-- The firm marks the period released.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update public.periods set status = 'released' where id = 'a2222222-0000-0000-0000-000000000002';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
set role authenticated;
update public.periods set status = 'filed' where id = 'a2222222-0000-0000-0000-000000000002';
select pg_temp.check((select status from public.periods where id = 'a2222222-0000-0000-0000-000000000002') = 'filed', 'client marks a released period as filed');
select pg_temp.raises($$insert into public.records (prep_client_id, record_date, kind) values ('22222222-2222-2222-2222-222222222222', '2026-02-15', 'expense')$$, 'records in a filed period are locked for the client');
-- Withdrawing TIN consent erases TINs.
update public.client_consents set withdrawn_at = now() where consent_type = 'tin';
reset role;
select pg_temp.check((select count(*) from public.tins) = 0, 'withdrawing TIN consent deletes stored TINs');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select pg_temp.check((select count(*) from public.packets) = 0, 'client 1 still cannot see client 2''s released packet');
reset role;

\echo 'PHASE 6 RLS: ALL CHECKS PASSED'
