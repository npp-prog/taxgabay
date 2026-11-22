import { dec, money, peso, type Dec } from "@taxgabay/tax-engine";
import type { Chart } from "./chart";
import { cleanAmount, lineNet, validateEntry } from "./journal";
import type { EntryLine, JournalEntry } from "./types";

export type FeedbackKind = "form" | "unbalanced" | "missing" | "extra" | "wrong_side" | "wrong_amount";

export interface Feedback {
  kind: FeedbackKind;
  message: string;
  account?: string;
}

export interface CheckResult {
  correct: boolean;
  feedback: Feedback[];
}

function netByAccount(lines: readonly EntryLine[]): Map<string, Dec> {
  const m = new Map<string, Dec>();
  for (const l of lines) m.set(l.account, (m.get(l.account) ?? dec(0)).plus(lineNet(l)));
  for (const [k, v] of m) if (v.isZero()) m.delete(k);
  return m;
}

/**
 * Compares a learner's entry with the answer key, ignoring line order and how amounts are split
 * across lines of the same account. Feedback points at the problem without giving the answer.
 */
export function checkEntry(attempt: readonly EntryLine[], key: Pick<JournalEntry, "lines">, chart: Chart): CheckResult {
  const lines = attempt
    .map((l) => ({ account: l.account, debit: cleanAmount(l.debit), credit: cleanAmount(l.credit) }))
    .filter((l) => l.account || l.debit || l.credit);
  const form = validateEntry({ lines }, chart);
  if (form.length) {
    return { correct: false, feedback: form.map((message) => ({ kind: message.startsWith("Debits") ? "unbalanced" : "form", message })) };
  }
  const got = netByAccount(lines);
  const want = netByAccount(key.lines);
  const fb: Feedback[] = [];
  for (const [acct, n] of got) {
    const name = chart.get(acct)!.name;
    const w = want.get(acct);
    if (!w) {
      fb.push({ kind: "extra", account: acct, message: `${name} should not be part of this entry.` });
    } else if (w.isPositive() !== n.isPositive()) {
      fb.push({ kind: "wrong_side", account: acct, message: `${name} is on the wrong side: it should be ${w.isPositive() ? "debited" : "credited"}.` });
    } else if (!w.equals(n)) {
      fb.push({ kind: "wrong_amount", account: acct, message: `The amount for ${name} is ${n.abs().greaterThan(w.abs()) ? "too high" : "too low"} (you entered ${peso(money(n.abs()))}).` });
    }
  }
  const missingDr = [...want].filter(([a, n]) => !got.has(a) && n.isPositive()).length;
  const missingCr = [...want].filter(([a, n]) => !got.has(a) && n.isNegative()).length;
  if (missingDr) fb.push({ kind: "missing", message: missingDr === 1 ? "One account that should be debited is missing." : `${missingDr} accounts that should be debited are missing.` });
  if (missingCr) fb.push({ kind: "missing", message: missingCr === 1 ? "One account that should be credited is missing." : `${missingCr} accounts that should be credited are missing.` });
  return { correct: fb.length === 0, feedback: fb };
}
