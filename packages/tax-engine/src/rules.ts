import type { ISODate, Provenance, TaxRule, TaxpayerCategory } from "./types";
import { parseISO } from "./dates";

export function inForce(row: Provenance, on: ISODate): boolean {
  parseISO(on);
  return row.effective_from <= on && (row.effective_to === null || on <= row.effective_to);
}

export interface FindRuleOptions {
  category?: TaxpayerCategory;
}

/**
 * Returns the single rule with `rule_key` in force on `on`.
 * Throws if none or more than one row matches — overlapping rows are a data error
 * the admin must fix, not something to resolve silently.
 */
export function findRule<V>(
  rules: readonly TaxRule[],
  key: string,
  on: ISODate,
  opts: FindRuleOptions = {},
): TaxRule<V> {
  const matches = rules.filter(
    (r) =>
      r.rule_key === key &&
      (opts.category === undefined || r.taxpayer_category === opts.category) &&
      inForce(r, on),
  );
  if (matches.length === 0) {
    throw new RuleNotFoundError(key, on, opts.category);
  }
  if (matches.length > 1) {
    throw new Error(
      `Overlapping rules for "${key}" on ${on}: ${matches.map((m) => m.id).join(", ")}`,
    );
  }
  return matches[0] as TaxRule<V>;
}

export class RuleNotFoundError extends Error {
  constructor(
    public readonly key: string,
    public readonly on: ISODate,
    public readonly category?: string,
  ) {
    super(
      `No rule "${key}"${category ? ` (${category})` : ""} in force on ${on}. ` +
        `The date may be outside the range the app has data for.`,
    );
    this.name = "RuleNotFoundError";
  }
}

/**
 * Validates a rule set: no overlapping effective ranges per (key, category),
 * from ≤ to, valid dates. Returns a list of problems (empty = OK).
 */
export function validateRules(rules: readonly TaxRule[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const groups = new Map<string, TaxRule[]>();
  for (const r of rules) {
    if (ids.has(r.id)) problems.push(`Duplicate id ${r.id}`);
    ids.add(r.id);
    try {
      parseISO(r.effective_from);
      if (r.effective_to) parseISO(r.effective_to);
    } catch (e) {
      problems.push(`${r.id}: ${(e as Error).message}`);
      continue;
    }
    if (r.effective_to && r.effective_to < r.effective_from) {
      problems.push(`${r.id}: effective_to before effective_from`);
    }
    if (!r.legal_basis.trim()) problems.push(`${r.id}: missing legal_basis`);
    const k = `${r.rule_key}|${r.taxpayer_category}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, rows] of groups) {
    const sorted = [...rows].sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (prev.effective_to === null || prev.effective_to >= cur.effective_from) {
        problems.push(`Overlap in ${k}: ${prev.id} and ${cur.id}`);
      }
    }
  }
  return problems;
}
