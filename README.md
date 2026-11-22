# TaxGabay

A Philippine BIR tax guide (web app, PWA). Users answer a short profile questionnaire and get a personalized list of what to register, file and pay, with deadlines, computations and the legal basis for each.

**Status: Phases 1–4 built — all tax content is pending CPA verification.** See [`docs/VERIFY.md`](docs/VERIFY.md).

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
| Business guide: books of accounts, chart of accounts, invoices and receipts, bank reconciliation, hiring and payroll, SSS/PhilHealth/Pag-IBIG contributions, employer filings, LGU permits and local business tax, financial statements | `/business-guide` |
| Accounting practice sets (freelancer, sari-sari store, VAT business, small corporation) with a business-owner track and an accounting-student track: auto-checked journal entries, ledger, trial balance, 10-column worksheet, statements, closing entries, books, tax returns from the books, worked solution and blank-form PDFs | `/practice`, `packages/accounting` |
| Registration roadmaps for DTI, SEC and CDA paths with saved progress and print-to-PDF | `/roadmap` |
| BIR issuances library: search, filters, plain-language summaries, related-issuance graph, official source links | `/issuances` |
| Knowledge hub: articles, Taglish-friendly glossary, FAQs | `/learn` |
| Site search across guides, articles, glossary, FAQs, issuances, life events and calculators | `/search` |
| PDF downloads of calculator results, roadmaps and the calendar | buttons on those pages |
| Admin: issuance workflow (draft → reviewed → published), drafting from a pasted text / PDF / BIR link, BIR deadline extensions and holidays, needs-verification dashboard, audit log | `/admin` |
| AI assistant answering only from TaxGabay's content, with a source for every point; refuses otherwise | `/assistant` |
| Multi-client mode for bookkeepers: several taxpayer profiles, switcher, all-clients calendar | `/clients` |
| Filipino interface (toggle in the header); tax content stays English | header "FIL / EN" |
| Mobile app (Expo) reusing the tax engine | `apps/mobile` |
| Privacy notice, account page with data download and deletion | `/privacy`, `/account` |
| Supabase schema with RLS, admin role, audit log; generated seed SQL | `supabase/` |

## Repository layout

```
apps/web               Next.js (App Router) + TypeScript + Tailwind v4, PWA
packages/tax-engine    Pure TS: rules (effective-dated data), calculators, deadline generator
packages/accounting    Pure TS: double-entry engine (ledger, worksheet, statements, answer checking) + practice sets
packages/content       MDX filing guides, hub articles, business guide + loaders
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
| `pnpm --filter @taxgabay/web test:e2e:admin` | Admin flows against a separate build that talks to an in-test mock of Supabase (port 3101) |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` across the monorepo |
| `pnpm db:seed-sql` | Regenerate `supabase/seed.sql` from tax-engine data |
| `pnpm db:verify-doc` | Regenerate `docs/VERIFY.md` from tax-engine data |
| `pnpm db:seed-issuances` | Regenerate `supabase/seed-issuances.sql` (starter issuances, inserted as drafts) |

## Tax rules are data

Every rate, bracket, threshold and deadline is a row in `packages/tax-engine/src/data/` with `effective_from`, `effective_to`, `legal_basis`, `source_url`, `last_verified_at` and `needs_verification`. Calculators take the taxable year or transaction date and pick the row in force (`findRule`). Overlapping rows are rejected by `validateRules` and by the test suite.

To verify or change a value:

1. Edit the row in `packages/tax-engine/src/data/`; set `needs_verification: false` and `last_verified_at: "YYYY-MM-DD"`.
2. Update the worked examples in `packages/tax-engine/test/fixtures/*.json` if the figures change.
3. Run `pnpm test && pnpm db:verify-doc && pnpm db:seed-sql`, and apply `seed.sql` to Supabase.

The disclaimer on each calculator switches from "not yet verified" to the oldest verification date once every rule it used is verified.

## Supabase (optional)

1. Create a Supabase project. Apply `supabase/migrations/*.sql` in order, then `supabase/seed.sql` and `supabase/seed-issuances.sql` (SQL editor, or `supabase db push` with the Supabase CLI).
2. Auth → Providers: enable Email (magic link) and Google. Add `<site>/account` to the redirect allow-list.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL`.
4. To make someone an admin, set `app_metadata.role = "admin"` on their user (service role / dashboard). Admins can write reference tables; every change goes to `admin_audit_log`.

When a local-mode user signs in for the first time, their browser profile, roadmap and checklist progress are uploaded to their account.

### Issuances library and admin

- The public library shows only **published** issuances (enforced by RLS). Without Supabase it shows the bundled starter list.
- The workflow is enforced by a database trigger: new issuances start as drafts; review requires a summary, the official source link and a tax type; only reviewed issuances can be published; editing a reviewed or published issuance sends it back to draft. Every change is in `admin_audit_log`.
- **Draft from source** (`/admin/ingest`): paste text, upload a PDF (text is extracted in the browser with pdf.js) or fetch from a link on bir.gov.ph, dof.gov.ph or officialgazette.gov.ph (through the admin-only `/api/admin/source` route). The parser suggests the type, number, date, title, tax types, topics and related issuances; you check them and write the summary.
- **Extensions and holidays** added in the admin area are merged into the calendar and the reminder job.
- Tax rules themselves stay in code (`packages/tax-engine/src/data`) so every change runs through the fixture tests.

### AI assistant

- Set `ANTHROPIC_API_KEY` (server only). Without it, `/assistant` still refuses unanswerable questions and points to search, but cannot answer.
- Each question makes one Claude API call (Claude Opus 5.5, with the server-side refusal fallback on) with the most relevant passages sent as documents with citations enabled. Questions with no relevant passage are refused without calling the API, and answers without citations are discarded.
- Only **verified** content is used. Until the CPA review is done, set `ASSISTANT_ALLOW_UNVERIFIED=1` on preview deployments to try it; answers are then labelled unverified.
- A simple rate limit applies: 8 questions per minute per IP, per server instance (`ASSISTANT_RATE_LIMIT` to change).

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
