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
