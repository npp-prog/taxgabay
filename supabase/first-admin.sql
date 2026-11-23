-- TaxGabay: one-time setup after the database is created (Supabase → SQL Editor → paste → Run).
-- 1. Sign in once on the live site at /login with YOUR email first, so your user exists.
-- 2. Replace the email below (it appears twice), then run this whole file.

-- Encryption key for TINs, created at random and kept in Supabase Vault (run once).
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'tin_key')
where not exists (select 1 from vault.secrets where name = 'tin_key');

-- Make you the site admin (issuances, holidays, deadlines) ...
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'REPLACE-WITH-YOUR-EMAIL';

-- ... and the firm admin and reviewer for document preparation.
insert into public.firm_members (user_id, role, display_name)
select id, 'admin', 'Neil Priolo, CPA' from auth.users where email = 'REPLACE-WITH-YOUR-EMAIL'
on conflict (user_id) do update set role = 'admin', display_name = excluded.display_name;

-- Check: this should show one row with role "admin".
select u.email, f.role, f.display_name from public.firm_members f join auth.users u on u.id = f.user_id;

-- Back up the TIN key somewhere safe (a password manager). Without it, stored TINs cannot be read.
select decrypted_secret as tin_key_backup from vault.decrypted_secrets where name = 'tin_key';
