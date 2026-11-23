# Turning on accounts — step by step

This turns on sign-in, the client portal (`/prepare`), the firm workspace (`/firm`), the admin area and reminders on the live site. It takes about 30 minutes. You need a Supabase account (free plan is fine to start) and access to the TaxGabay project on Vercel.

Nothing here needs a developer. Where you copy a value, copy it exactly — no spaces before or after.

---

## 1. Create the database (Supabase)

1. Go to **supabase.com → New project**.
   - Name: `taxgabay`
   - Database password: generate one and keep it in your password manager.
   - Region: **Southeast Asia (Singapore)** — closest to the Philippines.
2. Wait until the project says it is ready (1–2 minutes).
3. Open **SQL Editor → New query**. Open the file `supabase/setup-all.sql` from the repository on GitHub, press **Raw**, select all, copy, paste it into the editor, and press **Run**. It should finish with "Success. No rows returned".

## 2. Sign-in settings (Supabase)

1. **Authentication → URL Configuration**
   - **Site URL**: your live address, for example `https://taxgabay.vercel.app`
   - **Redirect URLs**: add `https://taxgabay.vercel.app/account` (use your own address)
2. **Authentication → Providers**: **Email** is on by default (sign-in by emailed link). Google sign-in is optional.
3. Optional but recommended for real use: **Authentication → Emails → SMTP settings** — connect your own email sender, so sign-in emails come from your domain and are not rate-limited.

## 3. Copy the keys (Supabase)

**Project Settings → API**. You need three values:

| Supabase shows | You will paste it into Vercel as |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key (click Reveal) | `SUPABASE_SERVICE_ROLE_KEY` — **secret: never share it or put it on a web page** |

## 4. Add the keys to the website (Vercel)

1. **vercel.com → the TaxGabay project → Settings → Environment Variables**.
2. Add each of these for **Production** (and Preview, if you use previews):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from step 3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 3 |
| `NEXT_PUBLIC_SITE_URL` | your live address, e.g. `https://taxgabay.vercel.app` |
| `CRON_SECRET` | any long random text (a password-manager-generated password is fine) |

3. **Deployments → the latest one → ⋯ → Redeploy**. Keys only take effect after a new deployment.

## 5. Make yourself the admin

1. On the live site, open **`/login`**, enter your email, and click the link you receive. (This creates your user.)
2. Back in Supabase, **SQL Editor → New query**, paste the file `supabase/first-admin.sql`, replace `REPLACE-WITH-YOUR-EMAIL` (two places) with the email you just used, and press **Run**.
3. The results show your email with role `admin`, and a `tin_key_backup` — **copy that key into your password manager**. TINs cannot be read without it.
4. On the site, sign out and sign in again (so the admin role takes effect).

## 6. Try it

- **`/firm`** opens your firm workspace. Create a test client — it shows an **invite code**.
- In another browser (or a private window), sign in with a different email, open **`/prepare`**, and enter the invite code. Give consent, add a sale, and press "My records … are complete".
- Back in `/firm`: open the client, **Prepare** the quarter, **Mark reviewed**, **Release to client**. The client can now download the packet.
- **`/admin`** opens the admin area (issuances, holidays, deadline extensions).

## 7. Optional extras

| What | Vercel variables | Where to get them |
|---|---|---|
| Email reminders (deadlines, and records due for firm clients) | `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` | resend.com — verify your domain, create an API key; the sender must be on that domain |
| Phone push reminders | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | ask Claude to generate them |
| AI assistant (`/assistant`) | `ANTHROPIC_API_KEY` | console.anthropic.com → API keys |

Redeploy after adding variables. The daily reminder job runs at about 7:13 AM Manila time.

## Adding staff later

In Supabase **SQL Editor**, after the staff member has signed in once:

```sql
insert into public.firm_members (user_id, role, display_name)
select id, 'preparer', 'Staff Name' from auth.users where email = 'staff@example.com';
```

Roles: `preparer` (prepares packets), `reviewer` (can also mark reviewed), `admin` (everything, including deleting clients). Only reviewers and admins can review, and a packet must be reviewed before it is released.

## If something goes wrong

- **"Accounts are not enabled"** on `/login`: the Vercel variables are missing or the site was not redeployed after adding them.
- **The sign-in link opens the wrong site**: check the Site URL and Redirect URLs in step 2.
- **"This account is not on the firm team"** on `/firm`: run step 5 again with the exact email you signed in with, then sign out and in.
- **"TIN encryption key is not configured"**: the first part of `first-admin.sql` did not run; run the file again.
