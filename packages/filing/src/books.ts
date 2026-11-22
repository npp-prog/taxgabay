import { makeChart, type Account, type Chart, type EntryLine, type JournalEntry } from "@taxgabay/accounting";
import { computeEwt, dec, findRule, money, splitVat, taxRules, type Dec, type ISODate, type TaxRule } from "@taxgabay/tax-engine";
import { payrollYear } from "./payroll";
import type { ClientInfo, ClientRecord, ExpenseCategory, JournalRecord } from "./types";

/**
 * Books of accounts posted automatically from a client's records (cash basis): sales to the
 * cash receipts book, expenses and payroll to the cash disbursements book, Forms 2307 received
 * to the general journal. Feed the result to the accounting engine for the ledger, trial balance
 * and financial statements.
 */
export interface Books {
  chart: Chart;
  entries: JournalEntry[];
  /** Capital (individuals) or retained earnings (corporations). */
  earningsAccount: string;
  warnings: string[];
}

const CATEGORY_ACCOUNT: Record<ExpenseCategory, string> = {
  cost_of_sales: "501",
  rent: "601",
  professional_fees: "602",
  contractors: "603",
  utilities: "604",
  supplies: "605",
  taxes_licenses: "606",
  transportation: "607",
  communication: "608",
  repairs: "609",
  salaries: "610",
  equipment: "151",
  other: "699",
};

export function clientChart(corporate: boolean): Account[] {
  const a = (code: string, name: string, type: Account["type"], section: Account["section"]): Account => ({ code, name, type, section });
  return [
    a("101", "Cash on hand and in bank", "asset", "current_assets"),
    a("111", "Creditable withholding tax", "asset", "current_assets"),
    a("112", "Input VAT", "asset", "current_assets"),
    a("121", "Accounts receivable", "asset", "current_assets"),
    a("131", "Other current assets", "asset", "current_assets"),
    a("151", "Equipment", "asset", "noncurrent_assets"),
    { code: "152", name: "Accumulated depreciation — equipment", type: "asset", section: "noncurrent_assets", contra: true },
    a("201", "Output VAT payable", "liability", "current_liabilities"),
    a("202", "Withholding tax payable — expanded", "liability", "current_liabilities"),
    a("203", "Withholding tax payable — compensation", "liability", "current_liabilities"),
    a("204", "SSS contributions payable", "liability", "current_liabilities"),
    a("205", "PhilHealth contributions payable", "liability", "current_liabilities"),
    a("206", "Pag-IBIG contributions payable", "liability", "current_liabilities"),
    a("211", "Loans payable", "liability", "current_liabilities"),
    a("212", "Other payables", "liability", "current_liabilities"),
    corporate ? a("301", "Retained earnings", "equity", "equity") : a("301", "Owner's capital", "equity", "equity"),
    { code: "302", name: corporate ? "Dividends declared" : "Owner's drawings", type: "equity", section: "equity", contra: true },
    a("401", "Sales and service income", "revenue", "revenue"),
    a("501", "Cost of sales", "expense", "cost_of_sales"),
    a("601", "Rent expense", "expense", "expenses"),
    a("602", "Professional fees", "expense", "expenses"),
    a("603", "Contractors and services", "expense", "expenses"),
    a("604", "Utilities", "expense", "expenses"),
    a("605", "Supplies", "expense", "expenses"),
    a("606", "Taxes and licenses", "expense", "expenses"),
    a("607", "Transportation", "expense", "expenses"),
    a("608", "Communication", "expense", "expenses"),
    a("609", "Repairs and maintenance", "expense", "expenses"),
    a("610", "Salaries and wages", "expense", "expenses"),
    a("611", "Employer's SSS, PhilHealth and Pag-IBIG", "expense", "expenses"),
    a("612", "Depreciation expense", "expense", "expenses"),
    a("699", "Other expenses", "expense", "expenses"),
  ];
}

const dr = (account: string, amount: Dec): EntryLine[] => (amount.isZero() ? [] : amount.isNegative() ? [{ account, credit: money(amount.negated()) }] : [{ account, debit: money(amount) }]);
const cr = (account: string, amount: Dec): EntryLine[] => dr(account, amount.negated());
const inRange = (d: ISODate, from: ISODate, to: ISODate) => from <= d && d <= to;

let accountCodes: Set<string> | null = null;

/** Why a manual journal entry cannot be posted, or null when it is fine. */
export function journalProblem(j: JournalRecord): string | null {
  if (j.lines.length < 2) return "it needs at least one debit and one credit line.";
  let dr = dec(0);
  let cr = dec(0);
  for (const l of j.lines) {
    if (!(accountCodes ??= new Set(clientChart(false).map((a) => a.code))).has(l.account)) return `account ${l.account || "(blank)"} is not in the chart of accounts.`;
    const d = l.debit ? l.debit.trim() : "";
    const c = l.credit ? l.credit.trim() : "";
    if ((d && c) || (!d && !c)) return "each line needs either a debit or a credit.";
    try {
      const v = dec(d || c);
      if (!v.greaterThan(0)) return "amounts must be greater than zero.";
      if (d) dr = dr.plus(v);
      else cr = cr.plus(v);
    } catch {
      return "amounts must be numbers.";
    }
  }
  return dr.equals(cr) ? null : `debits (${dr.toFixed(2)}) and credits (${cr.toFixed(2)}) are not equal.`;
}

export function buildBooks(input: { client: ClientInfo; records: readonly ClientRecord[]; from: ISODate; to: ISODate; rules?: readonly TaxRule[] }): Books {
  const rules = input.rules ?? taxRules;
  const corporate = ["corporation", "opc", "partnership"].includes(input.client.profile.taxpayer_type);
  const vatClient = input.client.profile.vat_status === "vat";
  const chart = makeChart(clientChart(corporate));
  const entries: JournalEntry[] = [];
  const warnings = new Set<string>();
  const vatRate = (d: ISODate) => findRule<{ rate: string }>(rules, "vat.rate", d).value.rate;

  for (const r of input.records) {
    if (r.kind === "journal") {
      // Opening balances carry into every later period; other entries post in their period.
      const opening = r.entry_type === "opening";
      if (!(opening ? r.date <= input.to : inRange(r.date, input.from, input.to))) continue;
      if (journalProblem(r)) {
        warnings.add(`Journal entry "${r.memo}" (${r.date}) is not balanced or uses an unknown account, so it was left out.`);
        continue;
      }
      entries.push({ id: r.id, date: r.date, book: "GJ", kind: opening ? "opening" : r.entry_type === "depreciation" ? "adjusting" : "regular", memo: r.memo, lines: r.lines.map((l) => (l.debit ? { account: l.account, debit: money(dec(l.debit)) } : { account: l.account, credit: money(dec(l.credit!)) })) });
    } else if (r.kind === "sale" && inRange(r.date, input.from, input.to)) {
      const vatable = vatClient && (r.vat_treatment ?? "vatable") === "vatable";
      const sp = vatable ? splitVat(r.amount, vatRate(r.date), true) : { net: dec(r.amount), vat: dec(0) };
      entries.push({ id: r.id, date: r.date, book: "CRB", memo: `Invoice ${r.document_no} — ${r.customer.name}`, lines: [...dr("101", dec(r.amount)), ...cr("401", sp.net), ...cr("201", sp.vat)] });
    } else if (r.kind === "form_2307_received" && inRange(r.period_to, input.from, input.to)) {
      entries.push({ id: r.id, date: r.period_to, book: "GJ", memo: `Form 2307 from ${r.payor.name}: tax withheld by the customer (${r.atc})`, lines: [...dr("111", dec(r.tax_withheld)), ...cr("101", dec(r.tax_withheld))] });
    } else if (r.kind === "expense" && inRange(r.date, input.from, input.to)) {
      const noVat = !vatClient || !r.supplier_vat_registered || r.category === "salaries" || r.category === "taxes_licenses";
      const sp = noVat ? { net: dec(r.amount), vat: dec(0) } : splitVat(r.amount, vatRate(r.date), true);
      let ewt = dec(0);
      if (r.withholding) {
        try {
          ewt = dec(computeEwt({ atc: r.withholding.atc, payment_date: r.date, amount: r.amount, vat_inclusive: !!r.supplier_vat_registered }, rules).result.ewt);
        } catch {
          warnings.add(`ATC ${r.withholding.atc} is not in the withholding table; the tax withheld from ${r.supplier.name} was not booked.`);
        }
      }
      if (r.category === "equipment") warnings.add("Equipment is recorded as an asset at cost; record depreciation with a journal entry (Depreciation expense / Accumulated depreciation).");
      entries.push({
        id: r.id,
        date: r.date,
        book: "CDB",
        memo: `${r.supplier.name}${r.document_no ? ` (${r.document_no})` : ""}`,
        lines: [...dr(CATEGORY_ACCOUNT[r.category], sp.net), ...dr("112", sp.vat), ...cr("202", ewt), ...cr("101", dec(r.amount).minus(ewt))],
      });
    }
  }

  const years = new Set<number>();
  for (let y = Number(input.from.slice(0, 4)); y <= Number(input.to.slice(0, 4)); y++) years.add(y);
  for (const y of years) {
    for (const l of payrollYear(input.records, y, rules).lines) {
      if (!inRange(l.record.date, input.from, input.to)) continue;
      const gross = l.basic.plus(l.benefits).plus(l.de_minimis);
      const er = l.sss_er.plus(l.ph_er).plus(l.hdmf_er);
      const net = gross.minus(l.contributions_ee).minus(l.withheld);
      entries.push({
        id: l.record.id,
        date: l.record.date,
        book: "CDB",
        memo: `Payroll — ${l.record.employee.name}`,
        lines: [
          ...dr("610", gross),
          ...dr("611", er),
          ...cr("203", l.withheld),
          ...cr("204", l.sss_ee.plus(l.sss_er)),
          ...cr("205", l.ph_ee.plus(l.ph_er)),
          ...cr("206", l.hdmf_ee.plus(l.hdmf_er)),
          ...cr("101", net),
        ],
      });
    }
  }

  entries.sort((a, b) => a.date.localeCompare(b.date) || a.book.localeCompare(b.book) || a.id.localeCompare(b.id));
  const has = (t: string) => input.records.some((r) => r.kind === "journal" && r.entry_type === t);
  const missing = [!has("opening") && "opening balances", !has("remittance") && "tax and contribution remittances", !has("depreciation") && input.records.some((r) => r.kind === "expense" && r.category === "equipment") && "depreciation"].filter(Boolean);
  if (missing.length) warnings.add(`Not yet entered as journal entries: ${missing.join(", ")}. Add them for complete books.`);
  if (input.from.slice(5) !== "01-01") warnings.add("For a quarter, the balance sheet shows opening balances plus this quarter's activity only; use the year-to-date view for balances as of the end of the quarter.");
  warnings.add("Income tax expense is not booked automatically.");
  return { chart, entries, earningsAccount: "301", warnings: [...warnings] };
}
