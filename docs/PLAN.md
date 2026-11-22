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

---

# Phase 4 Plan

Approved by the product owner ("Next") on 2026-11-22. No CPA verification has happened yet, which shapes the assistant (assumption 1).

## Assumptions

1. **AI assistant** answers only from TaxGabay's own content: rule rows (with legal basis), filing guides, hub articles, glossary, FAQs, life events and issuances. One Claude API request per question (Claude Opus 5.5, server-side refusal fallback on), with the retrieved passages sent as documents with **citations enabled**. The app shows each claim's source. It refuses — without calling the model — when retrieval finds nothing relevant, and replaces any answer that comes back without citations with a refusal. **Only verified content is used by default**; `ASSISTANT_ALLOW_UNVERIFIED=1` (for previews) also uses unverified content and labels the answer as unverified. Each question is answered on its own (no chat memory), which keeps every answer grounded. Needs `ANTHROPIC_API_KEY`; without it the page offers site search instead. A simple per-instance rate limit applies.
2. **Multi-client mode** (bookkeepers): an account or browser can hold several taxpayer profiles ("clients"), switch between them, and see a combined calendar across clients. Progress (obligations, checklists, roadmap) is kept per client. The single-profile experience stays the default.
3. **Filipino**: an i18n layer with English and Filipino UI text for the app shell and core flows (navigation, home, profile questionnaire, summary, calendar, checklists, assistant). Tax content (guides, articles, rule descriptions) stays in English for now; translating it needs a native speaker plus CPA review. The Filipino UI text is flagged for native-speaker review.
4. **Mobile app**: an Expo (React Native) app in `apps/mobile` reusing `@taxgabay/tax-engine` directly: profile, calendar and the four Phase 1 calculators, with data on the device. It is typechecked and unit-tested here; running it on a phone (Expo Go) is a manual step for the owner.

## Tasks

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 1 | Assistant core | Chunking, retrieval, verification gate, citation mapping, refusal rules — unit-tested. |
| 2 | Assistant API + page | `/api/assistant` and `/assistant`; e2e against a mock Claude API server. |
| 3 | Multi-client | Client switcher, per-client data, combined calendar, DB migration; e2e. |
| 4 | Filipino | Locale switch persisted; dictionaries; core pages translated; e2e. |
| 5 | Mobile | Expo app with calendar and calculators on tax-engine; typecheck + tests. |
| 6 | Docs | README, VERIFY.md (Filipino text review), PLAN. |

---

# Phase 5 Plan — Business guide and accounting practice sets

Requested by the product owner on 2026-11-22: "a complete guide for business and sample practice set for accounting records of the business". Choices made: both tracks (business owners and accounting students), both interactive exercises and worked examples, four sample businesses, and four new guide areas.

## Assumptions

1. **Accounting engine** (`packages/accounting`, pure TS, decimal money from tax-engine): chart of accounts, journal entries, books (general journal, cash receipts, cash disbursements, sales, purchases), posting to the ledger, trial balance, adjusting entries, 10-column worksheet, closing entries, financial statements (income statement, statement of changes in equity, balance sheet). Everything shown is **computed from the entries**, so the statements always agree with the books.
2. **Checking answers**: a learner's entry is compared with the answer key regardless of line order; feedback names the problem (not balanced, wrong account, wrong side, wrong amount, missing or extra line) without revealing the answer until asked.
3. **Four practice sets** (fictional businesses, one month or one quarter each): a non-VAT freelance service business, a merchandising sari-sari store, a VAT-registered business, and a small corporation with employees. Each has a profile, opening balances, dated transactions written as source documents (invoices, receipts, payroll), the answer key with explanations, period-end adjustments, and **tax returns computed from the books** with the existing tax engine (percentage tax / 8% vs graduated, VAT, withholding on compensation, expanded withholding, corporate income tax).
4. **Two tracks on the same sets**: the **owner track** keeps the BIR-required books and fills in returns, in plain language; the **student track** runs the full accounting cycle including the worksheet and closing entries.
5. **Worked examples** show every book filled in, and **printable blank forms** (journal, ledger, cash books) download as PDF.
6. **Business guide**: new chapters on bookkeeping basics, payroll and employer duties, LGU permits and local business tax, and financial statements. New facts (SSS, PhilHealth and Pag-IBIG contribution rates, 13th month pay, audited statements thresholds, record retention, LGU deadlines) are data flagged `needs_verification` and listed in VERIFY.md.
7. Practice progress is saved in the browser per set and track (no account needed).

## Tasks

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 1 | Accounting engine | Journal validation, posting, trial balance, worksheet, closing, statements, answer checking — unit-tested. |
| 2 | Practice-set data | Four sets with answer keys; tests prove every entry balances, statements balance, and returns compute. |
| 3 | Business guide | Chapters and flagged payroll/LGU data; pages. |
| 4 | Practice UI | Set picker, tracks, interactive journal with feedback, ledger, trial balance, worksheet, statements, books, returns, worked example, printable forms. |
| 5 | Tests and docs | Unit + e2e; README; VERIFY.md. |

---

# Phase 6 Plan — Client records in, prepared documents out

Reviewing CPA: **Neil Priolo, CPA**.

Requested by the product owner on 2026-11-22: clients put in all their records, TaxGabay **automatically prepares** the returns and supporting documents, and the client sends or files them. TaxGabay only prepares; it never files or pays on the client's behalf.

## How it works (one period, one client)

1. **Client enters records** in a client portal: sales, purchases and expenses, Form 2307s received, payroll, assets, bank balances. They can type them in, upload the TaxGabay Excel/CSV template, or attach photos/PDFs of receipts.
2. **TaxGabay checks the records**: missing months, gaps in invoice number series, 2307s with no matching sale, VAT on non-VAT purchases, totals that do not tie to the bank. Problems are shown as a to-do list for the client.
3. **TaxGabay posts the records to the books** with the accounting engine (Phase 5): journal, cash receipts and disbursements books, ledger, trial balance.
4. **TaxGabay prepares the documents** due for the period, from the client's profile and the deadline calendar (Phase 1):
   - **Returns, line by line** (values ready to type into eBIRForms/eFPS): 2551Q, 2550Q, 1701Q, 1701A/1701, 1702Q/1702-RT, 0619E, 1601EQ, 1601C, 1604C, 1604E.
   - **Schedules**: SAWT (creditable taxes withheld from you), QAP (taxes you withheld), summary list of sales and purchases (VAT), alphalist of employees and of payees.
   - **Certificates to give out**: Form 2307 to each supplier you withheld from; Form 2316 to each employee.
   - **Books and statements**: printed books of accounts for the period, financial statements, payroll register and SSS/PhilHealth/Pag-IBIG contribution summaries.
5. **The CPA reviews**: Neil Priolo, CPA (or a preparer he assigns) checks the package and marks it *Reviewed*. Nothing reaches the client as final until it is released. Released packets carry "Prepared by TaxGabay · Reviewed by Neil Priolo, CPA" with the review date; packets not yet reviewed are watermarked *Draft — not reviewed*.
6. **The client receives a filing packet**: one PDF per document, plus data files where BIR needs them, and a cover checklist: what to file, where (eBIRForms/eFPS/RDO), the deadline, how much to pay and where to pay, and what to keep. The client (or the firm, outside TaxGabay) files and pays.

## Assumptions

1. **Prepare, never file.** There is no public BIR filing API, and holding clients' eFPS/eBIRForms passwords is a security and liability risk. TaxGabay produces the documents and the step-by-step "copy this value into this field" guide; filing stays with the client.
2. **Form line maps are data**, effective-dated like rules: for each form version, which computed value goes in which item number. All start `needs_verification: true` and go into VERIFY.md and the review worksheet. A form version change (new BIR release) is a new data row, not new code.
3. **Data file formats** (SAWT, QAP, alphalist DAT files for the BIR's validation modules) are added only after the CPA confirms the current format specs. Until then the packet contains the schedules as PDF and CSV.
4. **New package `packages/filing`** (pure TS, no UI): record types, validation checks, record-to-entry posting rules (category → account), the preparation engine (period + records + profile → documents with `{ values, steps, warnings }`), and packet assembly. It reuses tax-engine calculators and the accounting engine, so every amount stays explainable.
5. **Accounts and server storage are required** for this feature (records are too important to live only in a browser). Explicit consent before saving; data in Supabase with row-level security; receipts in private storage buckets; full export and deletion (RA 10173).
6. **Two kinds of users**: *firm staff* (preparer, reviewer, admin) who see all of the firm's clients, and *client users* who see only their own business. The existing multi-client mode becomes the firm's client list.
7. **Receipt photos**: Phase 6 stores them as attachments. Automatic reading of receipts (AI extraction into records, always confirmed by a person) is a later, optional step.
8. **Worked examples are fixtures**: one complete client-period per business type (the four Phase 5 businesses), with the expected packet values, for the CPA to review — the same pattern as the calculator fixtures.

## Decisions (Neil Priolo, CPA, 2026-11-22)

1. **TIN**: stored **encrypted**, only after the client consents, visible only to the firm and that client, printed on prepared documents. Exception to the general "no TIN" rule, recorded in the privacy notice.
2. **Records**: **clients enter** them in their portal; the firm (Neil Priolo, CPA, or assigned staff) reviews and releases the packet.
3. **First batch**: **non-VAT individuals** — 2551Q, 1701Q, 1701A, 0619E, 1601EQ, Form 2307s to issue, SAWT and QAP.
4. **One firm**: Neil Priolo, CPA's firm, its staff and its clients. Multi-firm sign-up is out of scope.
5. **Form item numbers** are not invented: each line map row describes the field in words, and its BIR item number stays empty (`TODO(CPA)`) until confirmed against the current form version.

## Tasks (first batch)

| # | Task | Acceptance criteria |
|---|------|---------------------|
| 1 | Data model and migrations | Firms, members and roles, clients, client users, periods, records, attachments, packets, review status, audit log; RLS tests prove a client cannot see another client and staff only see their firm. |
| 2 | Records intake | Forms for each record type; Excel/CSV template download and import with row-level errors; receipt upload; consent screen; e2e. |
| 3 | Validation checks | Each check unit-tested with fixtures; to-do list in the portal. |
| 4 | `packages/filing` engine | Posting rules, preparation for the first-batch forms, schedules, 2307s; fixtures per worked example; 95%+ coverage. |
| 5 | Form line maps | Flagged data rows per form version; generated VERIFY.md section; review worksheet items. |
| 6 | Filing packet | PDF per document with item numbers and values, cover checklist with deadline/where to file/pay, CSV schedules, ZIP download; e2e. |
| 7 | Firm workflow | Staff dashboard by deadline and status (records incomplete → ready → prepared → reviewed → released → client marked filed); reminders to clients for missing records; audit log. |
| 8 | Docs | README, privacy notice update, VERIFY.md, PLAN. |

## Progress

- Done: schema + RLS (tasks 1), invite codes, records intake with CSV import (2), record checks (3), `packages/filing` for the first batch (4), flagged form line maps (5), packet PDF (6), firm workspace `/firm` with prepare → review → release and the client portal at `/prepare` (7), docs (8).
- Done after that: receipt uploads (photos/PDF, 10 MB, private bucket, signed links), "what the firm needs next" for clients with records due 10 days before each deadline (`RECORDS_LEAD_DAYS`, a firm rule, not a BIR rule), email reminders 5, 1 and 0 days before the records date (daily cron), firm overview sorted by next deadline with late records flagged, client data download (JSON) and firm-admin deletion of a client with all data.
- Second batch done: VAT-registered individuals — 2550Q (vatable, zero-rated and exempt sales; input tax by capital goods, goods and services; excess input tax carried over), summary lists of sales and purchases, 1701Q/1701A on sales net of VAT; the 8% option is refused for VAT clients.
- Third batch done: payroll — payroll records per employee per month, monthly 1601C with the December year-end adjustment, SSS/PhilHealth/Pag-IBIG contributions summary, 1604C with the alphalist of employees, and a 2316 per employee.
- Fourth batch done: corporations, OPCs and partnerships on a calendar year — cumulative 1702Q and 1702-RT (higher of regular rate, reduced 20% when eligible, and MCIT from the 4th year), plus the same percentage tax/VAT, withholding and payroll returns.
- Next batches: books of accounts and financial statements, monthly packets.
- Known limitation: packets are quarterly, but 0619E is monthly and falls due before the quarter ends. The firm can prepare a quarter's packet early (e.g. in February for January's 0619E); later batches should add monthly packets.

## Out of scope for Phase 6

Filing or paying on the client's behalf, storing BIR portal passwords, payment collection or billing for the firm, automatic receipt reading, and LGU (local business tax) returns.
