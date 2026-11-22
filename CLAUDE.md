# TaxGabay — conventions for Claude Code

Philippine BIR tax guide web app (PWA). Product owner and reviewing CPA: **Neil Priolo, CPA**, who verifies all tax content (named on disclaimers, guides and prepared documents). Full spec: `docs/SPEC.md`. Current phase plan: `docs/PLAN.md`. Values awaiting CPA review: `docs/VERIFY.md`.

## Layout
- `apps/web` — Next.js (App Router) + TypeScript strict + Tailwind v4; shadcn-style components in `src/components/ui`.
- `packages/tax-engine` — pure TS, no UI/framework deps. Calculators, deadline generator, rule lookup, profile applicability. Seed rule data in `src/data/`.
- `packages/content` — MDX filing guides with frontmatter (`title`, `form`, `tax_types`, `last_verified_at`, `legal_basis`).
- `supabase/` — SQL migrations (schema + RLS) and generated `seed.sql`.

## Commands
- `pnpm install`
- `pnpm dev` — web app on http://localhost:3000
- `pnpm test` — Vitest (tax-engine, with coverage)
- `pnpm test:e2e` — Playwright (builds and starts the web app)
- `pnpm lint`, `pnpm typecheck`, `pnpm build`
- `pnpm db:seed-sql` — regenerate `supabase/seed.sql` from tax-engine data

## Non-negotiables
1. **Never invent tax facts.** Any rate, threshold, deadline, form or issuance number you are not certain of goes in as data with `needs_verification: true` and a row in `docs/VERIFY.md`.
2. **Rules are data, effective-dated.** Every rule row has `effective_from`, `effective_to` (null = open), `legal_basis`, `source_url`, `last_verified_at`, `needs_verification`. Code never hard-codes a rate; it calls `findRule(rules, key, date)`.
3. **Explainable output.** Calculators return `{ result, steps }`; each step has `label`, `formula`, `amount`, `legal_basis`.
4. **Money is `decimal.js`.** Never JS floating point arithmetic on amounts. Round each step to 2 decimals half-up (`round2`).
5. **Worked examples are fixtures** (`packages/tax-engine/test/fixtures/*.json`) so the CPA can review/correct them; tests iterate over fixtures.
6. Every calculator and guide page renders `<Disclaimer lastVerified=… />`.
7. Privacy (RA 10173): minimal data, no TIN, consent before saving to the server, account deletion.

## Style
- Small, logical commits. Plain-language UI copy; explain Filipino/BIR terms on first use.
- Keep tax-engine free of `Date.now()`; pass dates in. Dates are ISO `YYYY-MM-DD` strings (no time zones).
