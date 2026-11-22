import Decimal from "decimal.js";

/** Isolated Decimal constructor so app-wide config never leaks in. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

export type MoneyInput = string | number | Dec;

export function dec(v: MoneyInput): Dec {
  if (typeof v === "string" && v.trim() === "") return new D(0);
  const d = new D(typeof v === "string" ? v.replace(/,/g, "") : v);
  if (!d.isFinite()) throw new Error(`Not a finite amount: ${String(v)}`);
  return d;
}

/** Round to centavos, half-up, as amounts are entered on BIR forms. */
export function round2(v: MoneyInput): Dec {
  return dec(v).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/** Fixed 2-decimal string (no thousands separators). */
export function money(v: MoneyInput): string {
  return round2(v).toFixed(2);
}

export function max0(v: Dec): Dec {
  return v.isNegative() ? new D(0) : v;
}

/** "₱1,234,567.89" — for formulas shown to the user. */
export function peso(v: MoneyInput): string {
  const s = round2(v).toFixed(2);
  const neg = s.startsWith("-");
  const [int, frac] = (neg ? s.slice(1) : s).split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}₱${grouped}.${frac}`;
}

/** "12%" from "0.12". */
export function pct(rate: MoneyInput): string {
  return `${dec(rate).times(100).toDecimalPlaces(4).toString()}%`;
}
