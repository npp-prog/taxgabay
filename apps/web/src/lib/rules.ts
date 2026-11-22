import { holidays, taxRules, type TaxRule } from "@taxgabay/tax-engine";

/**
 * Phase 1 uses the rule set bundled with tax-engine. Phase 2+ can load admin-edited
 * rules from Supabase and pass them to the same engine functions.
 */
export const rules: readonly TaxRule[] = taxRules;

export interface VerificationStatus {
  verified: boolean;
  /** Oldest verification date among the rules used, if all are verified. */
  lastVerified: string | null;
}

export function verificationFor(ruleIds: readonly string[]): VerificationStatus {
  const used = rules.filter((r) => ruleIds.includes(r.id));
  if (used.length === 0 || used.some((r) => r.needs_verification || !r.last_verified_at)) {
    return { verified: false, lastVerified: null };
  }
  const oldest = used.map((r) => r.last_verified_at!).sort()[0]!;
  return { verified: true, lastVerified: oldest };
}

export const HOLIDAY_YEARS = [...new Set(holidays.map((h) => h.year))].sort();
