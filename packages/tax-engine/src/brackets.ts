import { dec, max0, pct, peso, round2, type Dec, type MoneyInput } from "./money";
import type { Bracket } from "./types";

/** Applies an "over X but not over Y: base + rate × (income − X)" table. */
export function applyBrackets(brackets: readonly Bracket[], amount: MoneyInput): { tax: Dec; bracket: Bracket; formula: string } {
  const income = max0(round2(amount));
  const bracket = brackets.find((br) => {
    const aboveFloor = income.greaterThan(br.over) || dec(br.over).isZero();
    const belowCeiling = br.not_over === null || income.lessThanOrEqualTo(br.not_over);
    return aboveFloor && belowCeiling;
  });
  /* c8 ignore next -- tables are validated as contiguous from zero with an open top */
  if (!bracket) throw new Error(`No bracket for ${income.toString()}`);
  const tax = round2(dec(bracket.base).plus(income.minus(bracket.over).times(bracket.rate)));
  const formula = dec(bracket.rate).isZero()
    ? `${peso(income)} is not over ${peso(bracket.not_over ?? "0")}: no tax`
    : `${peso(bracket.base)} + ${pct(bracket.rate)} × (${peso(income)} − ${peso(bracket.over)})`;
  return { tax, bracket, formula };
}

/** "₱15 per ₱1,000 or fractional part thereof": the base is rounded up to whole units. */
export function perUnitOrFraction(base: MoneyInput, per: MoneyInput, amount: MoneyInput): { units: Dec; tax: Dec } {
  const units = max0(round2(base)).dividedBy(per).ceil();
  return { units, tax: round2(units.times(amount)) };
}
