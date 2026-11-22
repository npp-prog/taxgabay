# TaxGabay mobile (Expo)

A React Native app built with Expo that reuses `@taxgabay/tax-engine` directly, so calculations and deadlines match the web app exactly.

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the App Store or Google Play.
2. From the repo root:
   ```bash
   pnpm install
   pnpm --filter @taxgabay/mobile start
   ```
3. Scan the QR code in the terminal with your phone's camera (iOS) or the Expo Go app (Android). Your phone and computer must be on the same network (or press `s` → tunnel in the Expo CLI).

## What's included

- **Profile**: a compact version of the web questionnaire (taxpayer type, VAT status, income tax option, employees, expanded withholding, filing channel and eFPS group, fiscal year end for non-individuals, taxpayer size).
- **Calendar**: obligations for the next 12 months from the profile, grouped by month, with weekend/holiday roll-over, "Depends on your answers" and "Overdue" badges. Tap a return to mark it filed and paid.
- **Calculators**: income tax (8% vs graduated, OSD/itemized, mixed income), percentage tax, VAT and late filing/payment penalties, each with the step-by-step breakdown, legal basis and disclaimer.
- Light and dark mode; accessibility labels on every control.
- Data stays on the phone (AsyncStorage). Nothing is sent to a server.

## Not included (web only for now)

Accounts and sync, email/push reminders, checklists, registration roadmaps, filing guides, the issuances library, the knowledge hub, the AI assistant and the admin area.

## Commands

| Command | What it does |
|---|---|
| `pnpm --filter @taxgabay/mobile start` | Expo dev server (Expo Go) |
| `pnpm --filter @taxgabay/mobile typecheck` | `tsc --noEmit` |
| `pnpm --filter @taxgabay/mobile lint` | ESLint |
| `pnpm --filter @taxgabay/mobile test` | Vitest on the pure modules (store core, calculator view models, calendar) |
| `pnpm --filter @taxgabay/mobile export:check` | Bundles the Android JS with Metro (no device needed) — a quick check that the monorepo resolves |

## Notes

- Versions follow Expo SDK 58's own pinning (`expo@58.0.23`, React Native 0.88.1, React 19.3.0).
- `metro.config.js` watches the repo root and resolves workspace packages through pnpm's symlinks, so `@taxgabay/tax-engine` (TypeScript source) bundles without a build step.
- All tax values are seed data awaiting CPA verification; every result says "Last verified: not yet" until the rules it uses are verified.
