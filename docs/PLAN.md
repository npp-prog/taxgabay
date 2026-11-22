# Phase 1 Plan — TaxGabay MVP

Source spec: [`docs/SPEC.md`](./SPEC.md). This file breaks Phase 1 into tasks with acceptance criteria and records the assumptions made instead of blocking on questions.

## Assumptions (please confirm or correct)

1. **No Supabase project yet.** The app must run fully without one. When `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset, the app works in "local mode": profile, obligation statuses and roadmap progress live in the browser (localStorage), and sign-in is hidden. When the env vars are set, email + Google sign-in appears and the same data syncs to Supabase tables protected by RLS. Migrations and seed SQL are provided under `supabase/`.
2. **Rule data has one source of truth: TypeScript data files in `packages/tax-engine/src/data/`.** The engine ships with them as the default rule set (so calculators work offline and in tests), and `pnpm db:seed-sql` generates `supabase/seed.sql` from the same files. The engine's functions accept an injected rule set, so a later phase can load rules from Postgres (admin-edited) without code changes.
3. **Every seeded value is `needs_verification: true` and `last_verified_at: null`**, and is listed in `docs/VERIFY.md`. Values I am least sure of are marked **LOW CONFIDENCE** there (notably the compromise-penalty schedule and some 2026/2027 special non-working holidays).
4. **Income tax calculator scope (Phase 1):** individuals who are purely self-employed/professional, or mixed-income. Graduated rates (with OSD 40% or itemized deductions entered as one amount) vs the 8% option, including the percentage tax that applies under graduated rates for non-VAT taxpayers so the comparison is like-for-like. Pure compensation earners get the graduated computation only.
5. **Rounding:** all money is `decimal.js`; each computation step is rounded to 2 decimals (half-up), matching how amounts are entered on BIR forms. No exceptions so far.
6. **Rule selection date:** income tax uses 31 Dec of the taxable year (individuals are calendar-year taxpayers); quarterly percentage tax/VAT uses the last day of the quarter; penalties use the date the penalty accrues (rules in force on the due date for surcharge, and interest computed per day under whichever rate is in force on each day).
7. **Deadlines:** individuals always follow the calendar year. Quarterly VAT/percentage tax for non-individuals follow the profile's fiscal year end. Weekend/holiday roll-over moves to the next working day. BIR extensions override a generated date.
8. **Filing guides are skeletons** in Phase 1: the required headings, frontmatter and facts I am confident about, with `TODO(CPA)` markers where field-by-field content needs your input.
9. **UI kit:** shadcn/ui-style components written into `apps/web/src/components/ui` (same API and Tailwind classes as shadcn, without running its CLI).
10. **PDF export** of the roadmap uses a print stylesheet (browser "Save as PDF"); a generated PDF is a Phase 3 item.

## Tasks

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 1 | Monorepo setup | pnpm workspaces + Turborepo; `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck` run across packages; strict TS. |
| 2 | `packages/tax-engine` core | Decimal money helpers; `findRule()` picks the row in force on a date and throws if none/overlap; `{ result, steps[] }` result shape with `label`, `formula`, `amount`, `legal_basis`. |
| 3 | Seed data | Tax rules, deadline rules, forms, holidays 2026–2027 as data rows with legal basis; all `needs_verification`. `docs/VERIFY.md` lists every value. `supabase/seed.sql` generated. |
| 4 | Income tax calculator | Graduated (2018–2022 and 2023+ tables), OSD/itemized, 8% option with eligibility (≤ ₱3M, non-VAT), mixed income; side-by-side comparison with recommendation. Fixture-driven tests at bracket boundaries and the 2022/2023 change. |
| 5 | Percentage tax calculator | 3%, with the 1% CREATE window (1 Jul 2020 – 30 Jun 2023); tests either side of 30 Jun 2023. |
| 6 | VAT calculator | Inclusive/exclusive conversion, output − input, excess input carry-over. |
| 7 | Penalty calculator | Surcharge (25% / 50% willful; 10% micro/small after EOPT), interest per day (12% / 6% micro/small after EOPT), compromise schedule as data; tests across the EOPT effectivity date. |
| 8 | Deadline generator | Rules → dated obligations for a date range per profile; weekend/holiday roll-over; eFPS groups; fiscal quarters; extensions. Tests for each. |
| 9 | Profile model | Profile type, applicability evaluation (`applies_when`), "what applies to you" summary (registrations, returns, frequencies, tax types). |
| 10 | Supabase schema | Migration with all spec tables (+ `user_roadmap_progress`), RLS on every user table, admin role helper, audit log table. |
| 11 | Web app shell | Next.js App Router, Tailwind, shadcn-style UI, mobile-first nav, disclaimer component, PWA manifest + service worker caching guides and calculators. |
| 12 | Auth | Supabase email magic link + Google when configured; local mode otherwise; account deletion; privacy notice and consent checkbox. |
| 13 | Profiler wizard | 6–10 branching steps with "not sure?" help on each; saves locally or to Supabase; summary screen. |
| 14 | Calendar | 12 months from today; month grid, upcoming list, by-form views; mark filed/paid; `.ics` export. |
| 15 | Calculator pages | Income tax, percentage tax, VAT, penalty; each shows the step breakdown, legal basis, disclaimer and last-verified status. |
| 16 | Filing guides | 10 MDX skeletons in `packages/content/guides` with frontmatter; rendered at `/guides/[form]` with disclaimer. |
| 17 | Sole proprietorship roadmap | DTI → barangay → mayor's permit → BIR (1901, COR, books, invoices, ORUS) → SSS/PhilHealth/Pag-IBIG if with employees; progress saved; printable. |
| 18 | Tests | Vitest coverage ≥ 95% on tax-engine; Playwright: profiler → calendar, calculator breakdown, guide page. |
| 19 | Docs | README (setup, commands, env, deploy), `.env.example`, VERIFY.md, CLAUDE.md. |

---

# Phase 2 Plan

Approved by the product owner ("Go") on 2026-11-22. Phase 1 values remain unverified; Phase 2 adds more seed data under the same `needs_verification` rule.

## Assumptions

1. **Reminders** run as a daily scheduled job: a Next.js route (`/api/cron/reminders`) triggered by Vercel Cron and protected by `CRON_SECRET`. It uses the Supabase service-role key to read users who opted in, generates their obligations with the same engine, and sends **email via Resend** (HTTP API, `RESEND_API_KEY`) and **web push via VAPID** (`web-push`). A `reminder_log` table makes sends idempotent. The selection logic (`planReminders`) is pure and lives in tax-engine so it is unit-tested. Without the env vars, the job reports what it would send and sends nothing.
2. **Reminders need an account** (spec). Local-mode users see the settings with a prompt to sign in.
3. **Checklists** are data (`checklist-items.ts`) with `applies_when` against the profile, generated per period (month, quarter, year, one-time). Compliance score = done ÷ applicable items for the period. Progress is stored like roadmap progress (browser, synced to `user_checklist_progress` when signed in).
4. **Calculators added:** corporate (RCIT vs MCIT, reduced CREATE rate eligibility, MCIT start year), withholding on compensation (per-period tables + annual computation with the ₱90,000 benefits exclusion), expanded withholding by ATC (rates as data), estate, donor's (annual cumulative), capital gains (real property and unlisted shares), documentary stamp tax (sale of real property, original issue of shares, debt instruments). "Or fractional part thereof" rounds the base up to the next unit, as the NIRC wording states.
5. **Fiscal years straddling a rate change** (e.g. CREATE on 1 Jul 2020) are not pro-rated; the calculator warns and uses the rate in force on the last day of the taxable year.
6. **Estate tax** covers decedents who died on or after 1 Jan 2018 (TRAIN), citizens/residents only. The family home deduction is the decedent's share (half if conjugal/community), capped.
7. **Registration roadmaps** for SEC (partnership, corporation, OPC) and CDA (cooperative) paths are added to the same data table; the roadmap page lets the user switch paths, defaulting to their profile.
8. **Life-event flows** are data (`life-events.ts`) linking roadmap steps, guides, calculators and checklists; deadlines they mention are flagged for verification. Guides for the new forms they reference (1706, 1707, 1800, 1801, 2000-OT, 1905, 1702 series) are out of scope for Phase 2.

## Tasks

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 1 | Seed data | Corporate, withholding tables, benefits exclusion, de minimis, EWT ATCs, pre-CREATE rows; all flagged and in VERIFY.md. |
| 2 | Corporate calculator | RCIT (regular/reduced with eligibility) vs MCIT (from 4th year after commencement), higher is payable; fixtures. |
| 3 | Withholding on compensation | Monthly/semi-monthly/weekly/daily tables; annual tax with ₱90k exclusion and de minimis; fixtures at boundaries and across 2022/2023. |
| 4 | EWT by ATC | Rate lookup by ATC and date; VAT-exclusive base; fixtures. |
| 5 | Estate, donor's, CGT, DST | Each with steps and legal basis; fixtures including the cumulative donor's case and DST fractional rounding. |
| 6 | Checklists + score | Items as data, generator per period, score; tests. |
| 7 | Reminders | `planReminders` (pure, tested); migration for push subscriptions and reminder log; cron route; settings UI; service worker push handler. |
| 8 | SEC/CDA roadmaps | Steps as data; roadmap path switcher. |
| 9 | Life-event flows | 7 flows as data; index and detail pages. |
| 10 | Web pages + e2e | Pages for all new calculators, checklists, life events; Playwright coverage. |
| 11 | Docs | README, VERIFY.md, seed.sql regenerated. |

---

# Phase 3 Plan

Approved by the product owner ("Next") on 2026-11-22.

## Assumptions

1. **Issuances live in Supabase** (`issuances`, `issuance_links`). Only `published` rows are public. Without Supabase, the library falls back to a small bundled seed list (all `needs_verification`), so the pages work in local mode. Seed issuance numbers are limited to ones the existing rule data already cites; titles/dates I'm unsure of are left blank for the admin.
2. **Workflow is enforced in the database**: `draft → reviewed → published` (or back to `draft`), publishing requires a review, and every change is audited. There is no automatic publishing — the ingestion helper only creates drafts.
3. **Ingestion helper** (admin only): paste text, upload a PDF (text extracted in the browser with pdf.js), or give a URL on an allow-listed government domain (fetched by an admin-checked server route, then extracted in the browser). A pure parser drafts type, number, date, title, tax types, topics and referenced issuances; the admin edits and saves as a draft. It never writes the plain-language summary — the admin does (an AI assistant is Phase 4).
4. **Admin** requires a Supabase user with `app_metadata.role = "admin"`. Phase 3 admin covers: issuances (CRUD, links, workflow), BIR deadline extensions and holidays (merged into the calendar at runtime), a "needs verification" dashboard over the bundled rule data, and the audit log. **Tax rules stay code-reviewed data** (edited in `packages/tax-engine/src/data` with tests), not edited in the admin UI, so every change passes the fixture tests.
5. **Knowledge hub**: MDX articles (`packages/content/hub`), a Taglish-friendly glossary and FAQs as data. Everything is `needs_verification`.
6. **Search** covers guides, hub articles, glossary, FAQs, life events, calculators and issuances, with a pure ranking function (no external search service yet). Published issuances from Supabase are merged in when configured.
7. **PDF exports** are generated in the browser with pdf-lib (standard Helvetica): roadmap progress, calculator results (inputs, steps, legal basis, disclaimer) and the calendar. Characters Helvetica cannot encode are transliterated (e.g. ₱ → "PHP ", − → "-").

## Tasks

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 1 | Issuance model, seed, search | Pure module with filters (type, year, tax type, topic, status) and full-text ranking; tests. |
| 2 | DB workflow | Migration: slug, reviewed_by, transition trigger; verified against Postgres. |
| 3 | Ingestion parser | Drafts fields from text; tests on sample texts. |
| 4 | Library pages | `/issuances` list + filters; `/issuances/[slug]` with summary, effectivity, related-issuances graph, official source link. |
| 5 | Admin | `/admin` gate, dashboard, issuance editor with workflow and links, ingestion, extensions/holidays, audit log; source-fetch route with admin check and domain allow-list. |
| 6 | Knowledge hub | Articles, glossary, FAQs pages. |
| 7 | Site search | `/search` across all content. |
| 8 | PDF exports | Roadmap, calculator results, calendar; tests. |
| 9 | Tests, docs | Unit + e2e; README, VERIFY.md. |
