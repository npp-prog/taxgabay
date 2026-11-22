# TaxGabay

A Philippine BIR tax guide (web app, PWA). Users answer a short profile questionnaire and get a personalized list of what to register, file and pay, with deadlines, computations and the legal basis for each.

**Status: Phases 1 and 2 built — all tax content is pending CPA verification.** See [`docs/VERIFY.md`](docs/VERIFY.md).

- Spec: [`docs/SPEC.md`](docs/SPEC.md) · Phase plan and assumptions: [`docs/PLAN.md`](docs/PLAN.md) · Conventions: [`CLAUDE.md`](CLAUDE.md)

## What's built

| Area | Where |
|---|---|
| Taxpayer profiler (branching wizard, "Not sure?" help, consent) and "what applies to you" summary | `/profile`, `/profile/summary` |
| Tax calendar: 12 months from the profile, weekend/holiday roll-over, eFPS groups, fiscal quarters, mark filed & paid, `.ics` export | `/calendar` |
| Calculators with step-by-step breakdown and legal basis: income tax (8% vs graduated OSD/itemized, mixed income), percentage tax, VAT, penalties; corporate (RCIT vs MCIT), withholding on compensation (per payroll and year-end), expanded withholding by ATC, estate, donor's, capital gains, documentary stamp tax | `/calculators/*` |
| Compliance checklists (monthly, quarterly, annual, one-time) with a compliance score | `/checklists` |
| Email and web-push reminders 7/3/1 days before (configurable; needs an account) | `/account`, `/api/cron/reminders` |
| Life-event guides: start a business, hire, close, settle an estate, sell or donate property, move RDO | `/life-events` |
| 10 filing guides (MDX skeletons): 1701Q, 1701, 1701A, 2551Q, 2550Q, 1601C, 0619E, 1601EQ, 1604C, 1604E | `/guides` |
| Registration roadmaps for DTI, SEC and CDA paths with saved progress and print-to-PDF | `/roadmap` |
| Privacy notice, account page with data download and deletion | `/privacy`, `/account` |
| Supabase schema with RLS, admin role, audit log; generated seed SQL | `supabase/` |

## Repository layout

```
apps/web               Next.js (App Router) + TypeScript + Tailwind v4, PWA
packages/tax-engine    Pure TS: rules (effective-dated data), calculators, deadline generator
packages/content       MDX filing guides + loader
supabase/              migrations/ (schema + RLS), seed.sql (generated)
docs/                  SPEC, PLAN, VERIFY (generated)
```

## Getting started

Requirements: Node 22+, pnpm 10.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

With no environment variables, the app runs in **local mode**: the profile, calendar statuses and roadmap progress are stored in the browser, and sign-in is hidden. Everything else works.

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Web app dev server |
| `pnpm build` | Production build of all packages |
| `pnpm test` | Vitest for tax-engine (coverage gate 95%), content and the web reminder job |
| `pnpm test:e2e` | Playwright (builds and starts the app on port 3100; desktop + mobile) |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` across the monorepo |
| `pnpm db:seed-sql` | Regenerate `supabase/seed.sql` from tax-engine data |
| `pnpm db:verify-doc` | Regenerate `docs/VERIFY.md` from tax-engine data |

## Tax rules are data

Every rate, bracket, threshold and deadline is a row in `packages/tax-engine/src/data/` with `effective_from`, `effective_to`, `legal_basis`, `source_url`, `last_verified_at` and `needs_verification`. Calculators take the taxable year or transaction date and pick the row in force (`findRule`). Overlapping rows are rejected by `validateRules` and by the test suite.

To verify or change a value:

1. Edit the row in `packages/tax-engine/src/data/`; set `needs_verification: false` and `last_verified_at: "YYYY-MM-DD"`.
2. Update the worked examples in `packages/tax-engine/test/fixtures/*.json` if the figures change.
3. Run `pnpm test && pnpm db:verify-doc && pnpm db:seed-sql`, and apply `seed.sql` to Supabase.

The disclaimer on each calculator switches from "not yet verified" to the oldest verification date once every rule it used is verified.

## Supabase (optional)

1. Create a Supabase project. Apply `supabase/migrations/*.sql`, then `supabase/seed.sql` (SQL editor, or `supabase db push` with the Supabase CLI).
2. Auth → Providers: enable Email (magic link) and Google. Add `<site>/account` to the redirect allow-list.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL`.
4. To make someone an admin, set `app_metadata.role = "admin"` on their user (service role / dashboard). Admins can write reference tables; every change goes to `admin_audit_log`.

When a local-mode user signs in for the first time, their browser profile, roadmap and checklist progress are uploaded to their account.

### Reminders

A daily job at `/api/cron/reminders` (scheduled in `apps/web/vercel.json` for 23:13 UTC ≈ 7:13 AM in Manila) sends reminders to users who turned them on in **Account**. It needs, in addition to the variables above:

- `SUPABASE_SERVICE_ROLE_KEY` (server only) and `CRON_SECRET` (Vercel sends it as `Authorization: Bearer …`).
- Email: `RESEND_API_KEY` and `REMINDER_FROM_EMAIL` (a sender on a domain verified with Resend).
- Push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — generate keys with `npx web-push generate-vapid-keys`.

Channels without their variables are skipped and counted in the job's JSON summary, so you can test the job before wiring up email or push. Each send is recorded in `reminder_log`, so re-running the job on the same day does not send duplicates.

## Deploying (Vercel)

- Import the repo; set **Root Directory** to `apps/web` (Vercel detects pnpm workspaces and Next.js).
- Add the three environment variables above.
- Guides are statically generated at build time, so no filesystem access is needed at runtime.

## Disclaimer

TaxGabay explains and computes; it does not file on the user's behalf. For guidance only — verify with BIR issuances or consult a CPA.
