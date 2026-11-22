# Project: TaxGabay — Philippine BIR Tax Guide (web app, PWA)

> Source: "BIR Tax Guide App — Plan & Claude Code Prompt" (Claude Docs, 2026-11-22). Copied verbatim from the doc's Claude Code prompt block.

## Your role
You are the lead engineer building a production-quality web app that helps Philippine taxpayers understand and comply with BIR requirements. I am a CPA and the product owner. I will verify all tax content. Your job is to build a correct, testable, maintainable system where tax rules are data, not code.

## How to work
1. Before writing code, read this whole spec, then create `CLAUDE.md` (project conventions, commands, architecture summary) and `docs/PLAN.md` (task breakdown for Phase 1 with acceptance criteria).
2. Ask me up to 5 clarifying questions if something blocks Phase 1. Otherwise state your assumptions in PLAN.md and proceed.
3. Build ONLY Phase 1. At the end, run all tests, then give me: what was built, how to run it, what needs my verification, and the proposed Phase 2 plan. Wait for my approval before Phase 2.
4. Commit in small, logical steps with clear messages.
5. Never invent a tax rate, threshold, deadline, form number or issuance number. If you are unsure, add it to the seed data with `needs_verification: true` and list it in `docs/VERIFY.md`. Your training data may be outdated; I will confirm every value.

## Product summary
Users answer a short profile questionnaire (taxpayer type, business form, VAT status, income tax option, employees, filing channel, fiscal year, RDO, taxpayer size). The app then gives them a personalized: business registration roadmap, tax calendar with reminders, compliance checklists, step-by-step filing guides, calculators (tax and penalty), plus a searchable library of BIR issuances and a knowledge hub. Audience: aspiring business owners, sole proprietors, professionals, corporations/partnerships/OPCs/cooperatives, employers, employees and mixed-income earners, heirs (estate tax), and individuals with one-time transactions (sale of property, donation, sale of shares). Visitors can use calculators, guides and the library without an account; the profile, calendar, reminders and saved checklists need an account.

## Tech stack
- Monorepo with pnpm workspaces + Turborepo
- `apps/web`: Next.js (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, PWA (installable, offline access to guides and calculators)
- `packages/tax-engine`: pure TypeScript, zero UI or framework dependencies. All calculations, deadline generation and rule lookups live here.
- `packages/content`: MDX guides and knowledge articles with frontmatter (title, tax types, forms, last_verified_at, legal_basis)
- Supabase: Postgres, Auth (email + Google), Row Level Security on all user tables, Storage
- Testing: Vitest for tax-engine (target 95%+ coverage), Playwright for key user flows
- Money: use a decimal library (e.g. decimal.js) or integer centavos. Never floating point. Round as BIR forms do (to 2 decimals; document any exception).
- Deployment target: Vercel + Supabase. Provide `.env.example` and a README.

## Non-negotiable principles
1. **Effective-dated rules.** Every rate, bracket, threshold, exemption and deadline rule is a data row with `effective_from`, `effective_to` (nullable), `legal_basis` (text, e.g. "RA 10963 Sec. 5"), `source_url`, `last_verified_at`, `needs_verification`. Calculators take a taxable period or transaction date and pick the rule in force on that date.
2. **Explainable output.** Every calculator returns `{ result, steps[] }`, where each step has `label`, `formula`, `amount`, `legal_basis`. The UI shows the breakdown.
3. **Deadlines as rules.** A deadline rule defines: form code, frequency (monthly/quarterly/annual/one-time/event-based), due-day logic (e.g. "10th day of following month", "25th day after quarter end", "last day of month after quarter", "within 30 days of event"), applicability conditions against the profile, eFPS group variants, and weekend/holiday roll-over. A generator produces dated obligations per user profile.
4. **Philippine holidays** stored as data per year (regular, special non-working), editable by admin, plus support for BIR-announced deadline extensions.
5. **Disclaimers.** Every calculator and guide shows: "For guidance only. Verify with BIR issuances or consult a CPA." plus the last-verified date.
6. **Accessibility and plain language.** Mobile-first, WCAG AA, simple English with Filipino terms explained (i18n-ready structure for Filipino later).
7. **Privacy.** Comply with the Data Privacy Act (RA 10173): privacy notice, explicit consent, minimal data, account deletion, no TIN stored unless the user chooses to.

## Data model (Postgres; refine in PLAN.md)
- `tax_rules` (id, rule_key, tax_type, taxpayer_category, value_json, effective_from, effective_to, legal_basis, source_url, last_verified_at, needs_verification)
- `deadline_rules` (id, form_code, title, frequency, due_logic_json, applies_when_json, filing_channel, effective_from, effective_to, legal_basis, needs_verification)
- `holidays` (date, name, type, year)
- `deadline_extensions` (form_code, original_date, new_date, issuance_ref)
- `forms` (code, name, description, who_files, frequency, attachments_json, filing_channels, guide_slug)
- `issuances` (id, type [RR, RMO, RMC, RAMO, BIR Ruling, DOF Order, RA, EO, CTA/SC decision, SEC, LGU], number, title, date_issued, effectivity_date, tax_types[], topics[], summary_plain, status [active, amended, revoked, superseded], source_url, pdf_path, added_by, reviewed_at)
- `issuance_links` (from_id, to_id, relation [amends, revokes, implements, clarifies])
- `registration_steps` (business_form, order, agency, title, requirements_json, fees_note, online_link, est_days, legal_basis)
- `checklist_templates` and `checklist_items` (frequency, applies_when_json, form_code)
- `profiles` (user_id, taxpayer_type, business_form, vat_status, income_tax_option, has_employees, filing_channel, efps_group, fiscal_year_end, rdo_code, taxpayer_size, line_of_business, created_at)
- `user_obligations` (user_id, deadline_rule_id, period, due_date, status, completed_at)
- `user_checklist_progress`, `saved_calculations`, `reminder_settings`, `bookmarks`
- `admin_audit_log`

## Modules and acceptance criteria

### 1. Taxpayer profiler
- 6–10 step wizard with branching questions and "not sure" help text for each.
- Taxpayer types: employee only, self-employed/professional, mixed income, sole proprietorship, partnership, corporation, OPC, cooperative, estate/heirs, one-time transaction.
- Saves a profile; anonymous users get a local (browser) profile they can convert to an account.
- Output summary screen: "Here is what applies to you" — registrations, returns, frequencies, tax types.

### 2. Business registration roadmap
- Paths for sole proprietorship (DTI), partnership/corporation/OPC (SEC), cooperative (CDA).
- Steps: business name/entity registration → barangay clearance → mayor's/business permit → BIR registration (correct registration form by taxpayer type, COR (Form 2303), books of accounts, authority to print or invoicing setup, ORUS online option) → SSS, PhilHealth, Pag-IBIG employer registration if with employees.
- Each step: requirements, where to go, online links, typical processing time, legal basis. Progress saved per user. Export to PDF.

### 3. Tax calendar and reminders
- Generate obligations for the next 12 months from the profile using deadline rules, holidays and extensions.
- Views: month calendar, upcoming list, by form. Mark as filed/paid.
- Reminders by email and web push at 7, 3 and 1 day before (user-configurable). Export .ics.

### 4. Filing guides
- One MDX guide per form: who must file, deadline, where to file and pay, attachments, field-by-field walkthrough, common mistakes, related calculators, legal basis, last verified.
- Phase 1 forms: 1701Q, 1701, 1701A, 2551Q, 2550Q, 1601C, 0619E, 1601EQ, 1604C, 1604E. Later: 1702Q/RT/EX/MX, 1700, 1801, 1800, 1706, 1707, 2000, 2000-OT, 1905, 1906.

### 5. Compliance checklists
- Monthly, quarterly, annual and one-time checklists generated from the profile (e.g. returns, books updating, invoices, 2307 issuance, inventory list, AFS, posting of COR).
- Compliance score per period.

### 6. Tax calculators (in tax-engine, each with unit tests)
- Individual income tax: graduated rates vs 8% option, side-by-side comparison with eligibility check; mixed-income handling.
- Corporate income tax: RCIT (regular and reduced rate with eligibility check) vs MCIT, with the higher amount payable.
- VAT (output − input, with VAT-exclusive/inclusive conversion) and percentage tax.
- Withholding tax on compensation (monthly/semi-monthly/weekly/daily tables), de minimis and 13th-month/other benefits exclusion.
- Expanded withholding tax by ATC (rates as data).
- Estate tax: gross estate, deductions (standard, family home, claims, share of surviving spouse, etc.), net estate, tax due.
- Donor's tax (annual cumulative basis), capital gains tax on real property and unlisted shares, documentary stamp tax on common transactions.
- Every calculator accepts the taxable year or transaction date and uses the rules in force.

### 7. Penalty calculator
- Inputs: form, original due date, actual or planned payment date, basic tax due, taxpayer size, whether late filing and/or late payment, whether willful.
- Computes surcharge, deficiency/delinquency interest (prorated by days), and compromise penalty (schedule as data), applying reduced rates for micro and small taxpayers where the law provides.
- Shows formula and legal basis for each component.

### 8. Issuances library
- List, search (full text), filter by type, year, tax type, topic, status. Detail page: summary, effectivity, related issuances graph, link to the official source.
- Admin panel to add/edit issuances with a review step (draft → reviewed → published). No automatic publishing.
- Phase 3: optional ingestion helper that drafts records from a pasted BIR issuance PDF/URL for admin review.

### 9. Knowledge hub
- MDX articles, glossary, FAQs, "common mistakes". Search across hub, guides and issuances.

### 10. Life-event helpers
- Guided flows: start a business, hire first employee, close a business, settle an estate, sell real property, donate property, transfer RDO. Each flow links the relevant roadmap steps, guides, calculators and checklists.

### Admin
- Role-based admin (Supabase RLS + role claim). Manage rules, deadlines, holidays, extensions, issuances, content metadata. Every change logged in `admin_audit_log`. A "needs verification" dashboard.

## Seed data (ALL marked needs_verification: true; I will confirm)
Seed the rule tables with your best current understanding of: TRAIN (RA 10963) individual graduated rates for 2023 onward and the 8% option with its 3,000,000 threshold; CREATE (RA 11534) and CREATE MORE (RA 12066) corporate rates and MCIT; Ease of Paying Taxes Act (RA 11976) and its implementing RRs (taxpayer size classes, reduced penalties for micro/small, invoicing changes, removal of the annual registration fee); VAT 12% and threshold; percentage tax rate; estate tax 6% with standard deduction and family home cap; donor's tax 6% with annual exemption; CGT and DST rates; interest at double the legal interest rate; surcharge rates; standard deadline rules for the forms in module 4; and the Philippine holidays for 2026 and 2027. Cite the legal basis on every row. List every seeded value in docs/VERIFY.md as a table for my review.

## Phases
- **Phase 1 (MVP):** monorepo setup, auth, profiler, tax-engine with income tax (individual), percentage tax, VAT and penalty calculators, deadline generator + calendar (no notifications yet), 10 filing guides as MDX skeletons, registration roadmap for sole proprietorship, disclaimers, tests, README.
- **Phase 2:** reminders (email + push), checklists and compliance score, remaining calculators (corporate, withholding, estate, donor's, CGT, DST), registration roadmaps for SEC/CDA entities, life-event flows.
- **Phase 3:** issuances library with admin review workflow and search, knowledge hub, ingestion helper, PDF exports.
- **Phase 4:** AI assistant answering only from verified app content with citations (retrieval over guides, articles and issuances; must refuse when no source), Filipino language, multi-client mode for bookkeepers, mobile app (Expo) reusing tax-engine.

## Testing requirements
- tax-engine: unit tests for every calculator with worked examples at bracket boundaries, threshold edges and rule-change dates (e.g. a period before and after a rate change). Put each worked example in a fixture file I can review and correct.
- Deadline generator: tests for weekend/holiday roll-over, quarterly vs fiscal year, eFPS groups, and extensions.
- Playwright: profiler → calendar; calculator with breakdown; guide page.

## Definition of done for each phase
All tests pass, lint and typecheck clean, README updated, docs/VERIFY.md updated, and a short summary to me of what needs my verification.
