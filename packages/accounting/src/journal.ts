import { dec, max0, round2, type Dec } from "@taxgabay/tax-engine";
import type { Chart } from "./chart";
import type { EntryLine, JournalEntry } from "./types";

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;

/** Net amount of a line: debit positive, credit negative. */
export function lineNet(l: EntryLine): Dec {
  return round2(l.debit ?? 0).minus(round2(l.credit ?? 0));
}

export function entryTotals(lines: readonly EntryLine[]): { debit: Dec; credit: Dec } {
  let debit = dec(0);
  let credit = dec(0);
  for (const l of lines) {
    debit = debit.plus(max0(round2(l.debit ?? 0)));
    credit = credit.plus(max0(round2(l.credit ?? 0)));
  }
  return { debit, credit };
}

/** Problems with an entry's form (not whether it is the right answer). */
export function validateEntry(e: Pick<JournalEntry, "lines">, chart: Chart): string[] {
  const p: string[] = [];
  if (e.lines.length < 2) p.push("An entry needs at least one debit and one credit.");
  for (const [i, l] of e.lines.entries()) {
    const n = i + 1;
    if (!chart.has(l.account)) p.push(`Line ${n}: choose an account from the chart of accounts.`);
    const hasD = l.debit !== undefined && l.debit !== "";
    const hasC = l.credit !== undefined && l.credit !== "";
    if (hasD === hasC) p.push(`Line ${n}: enter either a debit or a credit amount.`);
    const v = hasD ? l.debit! : hasC ? l.credit! : "";
    if (v && !AMOUNT.test(v.replace(/,/g, ""))) p.push(`Line ${n}: "${v}" is not a valid amount.`);
    else if (v && dec(v.replace(/,/g, "")).isZero()) p.push(`Line ${n}: the amount cannot be zero.`);
  }
  if (p.length === 0) {
    const t = entryTotals(e.lines);
    if (!t.debit.equals(t.credit)) p.push(`Debits (${t.debit.toFixed(2)}) and credits (${t.credit.toFixed(2)}) are not equal.`);
  }
  return p;
}

export function cleanAmount(v: string | undefined): string | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  return v.replace(/,/g, "").trim();
}

export function sortEntries<T extends Pick<JournalEntry, "date" | "id">>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}
