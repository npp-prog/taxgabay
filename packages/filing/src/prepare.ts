import {
  addMonths,
  computeCorporateIncomeTax,
  computeEwt,
  computeIndividualIncomeTax,
  computePercentageTax,
  dec,
  deadlineExtensions,
  deadlineRules,
  findRule,
  generateObligations,
  holidays,
  max0,
  money,
  peso,
  round2,
  splitVat,
  taxRules,
  type Dec,
  type DeadlineRule,
  type Holiday,
  type ISODate,
  type Step,
  type TaxRule,
} from "@taxgabay/tax-engine";
import { checkRecords } from "./checks";
import { employeeKey, linesInMonth, payrollIn, payrollYear } from "./payroll";
import { linesFor } from "./data/form-lines";
import { inRange, monthLabel, quarterLabel, quarterMonths, quarterRange, yearRange, type Range } from "./periods";
import type { ClientInfo, ClientRecord, ExpenseRecord, Form2307Received, Form2316Received, Issue, Packet, Party, PreparedDocument, PreparedField, QuarterRef, SaleRecord } from "./types";

export interface PrepareInput {
  client: ClientInfo;
  records: readonly ClientRecord[];
  period: QuarterRef;
  /**
   * Prepare a monthly packet for this calendar month (must fall in `period`): the month's 0619E
   * (not for the quarter's last month), 1601C and contributions. Omit for the quarterly packet.
   */
  month?: number;
  rules?: readonly TaxRule[];
  deadlines?: readonly DeadlineRule[];
  holidayList?: readonly Holiday[];
}

const sum = (xs: readonly (string | Dec)[]) => xs.reduce<Dec>((a, x) => a.plus(x), dec(0));
const step = (label: string, formula: string, amount: string | Dec, legal_basis: string | null = null): Step => ({ label, formula, amount: money(amount), legal_basis });

interface Ctx {
  input: PrepareInput;
  rules: readonly TaxRule[];
  issues: Issue[];
  due: (form: string, periodEnd: ISODate) => { date: ISODate; needs_verification: boolean } | null;
}

function fieldsFor(form: string, on: ISODate, values: Record<string, string>): { fields: PreparedField[]; verified: boolean } {
  const lines = linesFor(form, on).filter((l) => l.field_key in values);
  return {
    fields: lines.map((l) => ({ key: l.field_key, label: l.label, item: l.item, value: values[l.field_key]! })),
    // A document with no mapped boxes (a schedule) has an unconfirmed layout/format.
    verified: lines.length > 0 && lines.every((l) => !l.needs_verification),
  };
}

function rulesVerified(rules: readonly TaxRule[], ids: readonly string[]) {
  return ids.every((id) => rules.find((r) => r.id === id)?.needs_verification === false);
}

function doc(ctx: Ctx, d: Omit<PreparedDocument, "fields" | "needs_verification" | "due_date"> & { values: Record<string, string> }): PreparedDocument {
  const { values, ...rest } = d;
  const f = fieldsFor(d.form, d.period_end, values);
  const due = ctx.due(d.form, d.period_end);
  return {
    ...rest,
    fields: f.fields,
    due_date: due?.date ?? null,
    needs_verification: !rulesVerified(ctx.rules, d.rules_used) || !f.verified || !!due?.needs_verification,
  };
}

const salesIn = (records: readonly ClientRecord[], r: Range) => records.filter((x): x is SaleRecord => x.kind === "sale" && inRange(x.date, r));
const expensesIn = (records: readonly ClientRecord[], r: Range) => records.filter((x): x is ExpenseRecord => x.kind === "expense" && inRange(x.date, r));
/** 2307s whose covered period ends within the range. */
const certsIn = (records: readonly ClientRecord[], r: Range) => records.filter((x): x is Form2307Received => x.kind === "form_2307_received" && inRange(x.period_to, r));

/** Depreciation booked with journal entries (account 612) within a range, deductible as an expense. */
function depreciationIn(ctx: Ctx, r: Range): Dec {
  let d = dec(0);
  for (const j of ctx.input.records) {
    if (j.kind !== "journal" || !inRange(j.date, r)) continue;
    for (const l of j.lines) if (l.account === "612") d = l.debit ? d.plus(l.debit) : d.minus(l.credit ?? "0");
  }
  return d;
}

// ---------- VAT helpers ----------

const isVatClient = (ctx: Ctx) => ctx.input.client.profile.vat_status === "vat";
const vatRule = (ctx: Ctx, on: ISODate) => findRule<{ rate: string }>(ctx.rules, "vat.rate", on);
const treatment = (s: SaleRecord) => s.vat_treatment ?? "vatable";

/** A sale's amount for income tax: net of VAT for vatable sales of a VAT-registered client. */
function saleNet(ctx: Ctx, s: SaleRecord): Dec {
  if (!isVatClient(ctx) || treatment(s) !== "vatable") return dec(s.amount);
  return splitVat(s.amount, vatRule(ctx, s.date).value.rate, true).net;
}

/** Input VAT on an expense (VAT-registered client buying from a VAT-registered supplier). */
function expenseSplit(ctx: Ctx, e: ExpenseRecord): { net: Dec; vat: Dec } {
  if (!isVatClient(ctx) || !e.supplier_vat_registered || e.category === "salaries" || e.category === "taxes_licenses") return { net: dec(e.amount), vat: dec(0) };
  const sp = splitVat(e.amount, vatRule(ctx, e.date).value.rate, true);
  return { net: sp.net, vat: sp.vat };
}

type PurchaseClass = "capital_goods" | "goods" | "services" | "no_vat";
function purchaseClass(ctx: Ctx, e: ExpenseRecord): PurchaseClass {
  if (expenseSplit(ctx, e).vat.isZero()) return "no_vat";
  if (e.category === "equipment") return "capital_goods";
  if (e.category === "cost_of_sales" || e.category === "supplies") return "goods";
  return "services";
}

interface VatQuarter {
  vatable: Dec;
  output: Dec;
  zero: Dec;
  exempt: Dec;
  purchases: Record<PurchaseClass, Dec>;
  input: Dec;
}

function vatQuarter(ctx: Ctx, range: Range): VatQuarter {
  const out: VatQuarter = { vatable: dec(0), output: dec(0), zero: dec(0), exempt: dec(0), purchases: { capital_goods: dec(0), goods: dec(0), services: dec(0), no_vat: dec(0) }, input: dec(0) };
  for (const s of salesIn(ctx.input.records, range)) {
    const t = treatment(s);
    if (t === "zero_rated") out.zero = out.zero.plus(s.amount);
    else if (t === "exempt") out.exempt = out.exempt.plus(s.amount);
    else {
      const sp = splitVat(s.amount, vatRule(ctx, s.date).value.rate, true);
      out.vatable = out.vatable.plus(sp.net);
      out.output = out.output.plus(sp.vat);
    }
  }
  for (const e of expensesIn(ctx.input.records, range)) {
    const sp = expenseSplit(ctx, e);
    const c = purchaseClass(ctx, e);
    out.purchases[c] = out.purchases[c].plus(sp.net);
    out.input = out.input.plus(sp.vat);
  }
  return out;
}

/** Excess input VAT carried into a quarter, chaining every earlier quarter that has records. */
function vatCarriedInto(ctx: Ctx, q: QuarterRef): Dec {
  const dates = ctx.input.records.map((r) => r.date).sort();
  if (!dates.length) return dec(0);
  let y = Number(dates[0]!.slice(0, 4));
  let k = Math.floor((Number(dates[0]!.slice(5, 7)) - 1) / 3) + 1;
  let carry = dec(0);
  while (y < q.year || (y === q.year && k < q.quarter)) {
    const v = vatQuarter(ctx, quarterRange({ year: y, quarter: k as 1 | 2 | 3 | 4 }));
    carry = max0(v.input.plus(carry).minus(v.output));
    if (++k > 4) {
      k = 1;
      y++;
    }
  }
  return carry;
}

// ---------- VAT return (2550Q) and summary lists ----------

function prepare2550Q(ctx: Ctx, q: QuarterRef, range: Range): PreparedDocument {
  const v = vatQuarter(ctx, range);
  const carried = vatCarriedInto(ctx, q);
  const totalInput = v.input.plus(carried);
  const payable = v.output.minus(totalInput);
  const rule = vatRule(ctx, range.end);
  const rate = `${dec(rule.value.rate).times(100).toString()}%`;
  const warnings = ["Input tax is claimed only for purchases from VAT-registered suppliers with valid VAT invoices or receipts. Keep them with your books."];
  if (!v.purchases.capital_goods.isZero()) warnings.push("Input tax on capital goods may have to be spread over several periods under the rules in force when they were bought (to confirm with Neil Priolo, CPA).");
  if (!v.zero.isZero()) warnings.push("Zero-rated sales need supporting documents (and, for some, prior BIR approval) — confirm with Neil Priolo, CPA.");
  return doc(ctx, {
    id: `2550Q-${range.end}`,
    form: "2550Q",
    title: "Quarterly VAT return",
    period_label: quarterLabel(q),
    period_start: range.start,
    period_end: range.end,
    values: {
      vatable_sales: money(v.vatable),
      output_vat: money(v.output),
      zero_rated_sales: money(v.zero),
      exempt_sales: money(v.exempt),
      total_sales: money(v.vatable.plus(v.zero).plus(v.exempt)),
      purchases_capital_goods: money(v.purchases.capital_goods),
      purchases_goods: money(v.purchases.goods),
      purchases_services: money(v.purchases.services),
      purchases_no_vat: money(v.purchases.no_vat),
      input_vat_current: money(v.input),
      input_vat_carried_over: money(carried),
      total_input_vat: money(totalInput),
      payable: money(payable),
    },
    steps: [
      step("Vatable sales, net of VAT", `Each invoice total ÷ (1 + ${rate}), added up`, v.vatable, rule.legal_basis),
      step("Output tax", `Each invoice total − its net amount, added up`, v.output, rule.legal_basis),
      step("Input tax on purchases from VAT-registered suppliers", `Each bill ÷ (1 + ${rate}) taken out of the bill, added up`, v.input, "NIRC Sec. 110"),
      step("Add: excess input tax carried over", "From earlier quarters' records", carried, "NIRC Sec. 110(B)"),
      step(payable.isNegative() ? "Excess input tax carried to the next quarter" : "VAT payable", `${peso(v.output)} − ${peso(totalInput)}`, payable.abs(), "NIRC Sec. 110(B)"),
    ],
    amount_payable: money(max0(payable)),
    warnings,
    rules_used: [rule.id],
  });
}

function prepareSalesList(ctx: Ctx, q: QuarterRef, range: Range): PreparedDocument {
  const m = new Map<string, { name: string; tin: string; exempt: Dec; zero: Dec; taxable: Dec; vat: Dec }>();
  for (const s of salesIn(ctx.input.records, range)) {
    const k = payeeKey(s.customer);
    const cur = m.get(k) ?? { name: s.customer.name, tin: s.customer.tin ?? "", exempt: dec(0), zero: dec(0), taxable: dec(0), vat: dec(0) };
    const t = treatment(s);
    if (t === "exempt") cur.exempt = cur.exempt.plus(s.amount);
    else if (t === "zero_rated") cur.zero = cur.zero.plus(s.amount);
    else {
      const sp = splitVat(s.amount, vatRule(ctx, s.date).value.rate, true);
      cur.taxable = cur.taxable.plus(sp.net);
      cur.vat = cur.vat.plus(sp.vat);
    }
    m.set(k, cur);
  }
  const rows = [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  return doc(ctx, {
    id: `SLS-${range.end}`,
    form: "SLS",
    title: "Summary list of sales (attachment to 2550Q)",
    period_label: quarterLabel(q),
    period_start: range.start,
    period_end: range.end,
    values: {},
    steps: [step("Total output tax (must equal the 2550Q)", rows.map((r) => peso(r.vat)).join(" + ") || "None", sum(rows.map((r) => r.vat)))],
    schedule: {
      columns: [
        { key: "tin", label: "Customer TIN" },
        { key: "name", label: "Customer" },
        { key: "exempt", label: "Exempt", align: "right" },
        { key: "zero", label: "Zero-rated", align: "right" },
        { key: "taxable", label: "Taxable (net)", align: "right" },
        { key: "vat", label: "Output tax", align: "right" },
      ],
      rows: rows.map((r) => ({ tin: r.tin, name: r.name, exempt: money(r.exempt), zero: money(r.zero), taxable: money(r.taxable), vat: money(r.vat) })),
    },
    amount_payable: "0.00",
    warnings: ["Whether you must submit summary lists, and in which file format, depends on BIR thresholds and rules to be confirmed by Neil Priolo, CPA. Sales to walk-in customers are usually reported as one line."],
    rules_used: [],
  });
}

function preparePurchaseList(ctx: Ctx, q: QuarterRef, range: Range): PreparedDocument {
  const m = new Map<string, { name: string; tin: string; no_vat: Dec; services: Dec; capital_goods: Dec; goods: Dec; vat: Dec }>();
  for (const e of expensesIn(ctx.input.records, range)) {
    if (e.category === "salaries" || e.category === "taxes_licenses") continue;
    const k = payeeKey(e.supplier);
    const cur = m.get(k) ?? { name: e.supplier.name, tin: e.supplier.tin ?? "", no_vat: dec(0), services: dec(0), capital_goods: dec(0), goods: dec(0), vat: dec(0) };
    const sp = expenseSplit(ctx, e);
    const c = purchaseClass(ctx, e);
    cur[c] = cur[c].plus(sp.net);
    cur.vat = cur.vat.plus(sp.vat);
    m.set(k, cur);
  }
  const rows = [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  return doc(ctx, {
    id: `SLP-${range.end}`,
    form: "SLP",
    title: "Summary list of purchases (attachment to 2550Q)",
    period_label: quarterLabel(q),
    period_start: range.start,
    period_end: range.end,
    values: {},
    steps: [step("Total input tax (must equal the 2550Q current input tax)", rows.map((r) => peso(r.vat)).join(" + ") || "None", sum(rows.map((r) => r.vat)))],
    schedule: {
      columns: [
        { key: "tin", label: "Supplier TIN" },
        { key: "name", label: "Supplier" },
        { key: "no_vat", label: "Exempt / non-VAT", align: "right" },
        { key: "services", label: "Services", align: "right" },
        { key: "capital_goods", label: "Capital goods", align: "right" },
        { key: "goods", label: "Other goods", align: "right" },
        { key: "vat", label: "Input tax", align: "right" },
      ],
      rows: rows.map((r) => ({ tin: r.tin, name: r.name, no_vat: money(r.no_vat), services: money(r.services), capital_goods: money(r.capital_goods), goods: money(r.goods), vat: money(r.vat) })),
    },
    amount_payable: "0.00",
    warnings: ["Whether you must submit summary lists, and in which file format, depends on BIR thresholds and rules to be confirmed by Neil Priolo, CPA."],
    rules_used: [],
  });
}

// ---------- Payroll: 1601C, contributions, 1604C, 2316 ----------

function prepare1601C(ctx: Ctx, month: Range): PreparedDocument {
  const year = Number(month.start.slice(0, 4));
  const { lines } = payrollYear(ctx.input.records, year, ctx.rules);
  const ls = linesInMonth(lines, month.start);
  const total = sum(ls.map((l) => l.basic.plus(l.benefits).plus(l.de_minimis)));
  const nonTax = sum(ls.map((l) => l.contributions_ee.plus(l.de_minimis).plus(l.benefits).plus(l.record.minimum_wage_earner ? l.basic : 0)));
  const withheld = sum(ls.map((l) => l.withheld));
  const warnings: string[] = ["13th month pay and other benefits are treated as non-taxable when paid; any excess over the annual ceiling is taxed in the December year-end adjustment."];
  if (ls.some((l) => l.record.minimum_wage_earner)) warnings.push("Minimum wage earners: their statutory minimum wage is treated as exempt (holiday, overtime, night-shift and hazard pay too). Confirm each employee's status.");
  if (withheld.isNegative()) warnings.push("More was withheld during the year than the annual tax: refund the difference to the employees. How the refund is applied against later remittances is to be confirmed with Neil Priolo, CPA.");
  if (!ls.length) warnings.push("No payroll is recorded for this month.");
  return doc(ctx, {
    id: `1601C-${month.end}`,
    form: "1601C",
    title: "Monthly remittance of tax withheld on compensation",
    period_label: monthLabel(month),
    period_start: month.start,
    period_end: month.end,
    values: { total_compensation: money(total), non_taxable: money(nonTax), taxable_compensation: money(total.minus(nonTax)), tax_withheld: money(withheld), payable: money(max0(withheld)) },
    steps: [
      ...ls.map((l) => step(`${l.record.employee.name}`, l.month === 12 ? "December: year-end adjustment" : `Monthly table on ${peso(l.basic)} less ${peso(l.contributions_ee)} contributions`, l.withheld, "RR 2-98 Sec. 2.79, as amended")),
      step("Total tax withheld this month", ls.map((l) => peso(l.withheld)).join(" + ") || "No payroll", withheld),
    ],
    schedule: {
      columns: [
        { key: "name", label: "Employee" },
        { key: "basic", label: "Basic pay", align: "right" },
        { key: "contrib", label: "Contributions (employee)", align: "right" },
        { key: "other", label: "Benefits and de minimis", align: "right" },
        { key: "tax", label: "Tax withheld", align: "right" },
      ],
      rows: ls.map((l) => ({ name: l.record.employee.name, basic: money(l.basic), contrib: money(l.contributions_ee), other: money(l.benefits.plus(l.de_minimis)), tax: money(l.withheld) })),
    },
    amount_payable: money(max0(withheld)),
    warnings,
    rules_used: [...new Set(ls.flatMap((l) => l.rules_used))],
  });
}

function prepareContributions(ctx: Ctx, q: QuarterRef, range: Range, label = quarterLabel(q)): PreparedDocument {
  const { lines } = payrollYear(ctx.input.records, q.year, ctx.rules);
  const ls = lines.filter((l) => inRange(l.record.date, range));
  const t = (f: (l: (typeof ls)[number]) => Dec) => sum(ls.map(f));
  const total = t((l) => l.sss_ee.plus(l.sss_er).plus(l.ph_ee).plus(l.ph_er).plus(l.hdmf_ee).plus(l.hdmf_er));
  return doc(ctx, {
    id: `CONTRIB-${range.end}`,
    form: "SSS/PhilHealth/Pag-IBIG",
    title: "Contributions to remit (SSS, PhilHealth, Pag-IBIG)",
    period_label: label,
    period_start: range.start,
    period_end: range.end,
    values: {},
    steps: [
      step("SSS (employee + employer)", `${peso(t((l) => l.sss_ee))} + ${peso(t((l) => l.sss_er))}`, t((l) => l.sss_ee.plus(l.sss_er)), "RA 11199 (Social Security Act of 2018)"),
      step("PhilHealth (employee + employer)", `${peso(t((l) => l.ph_ee))} + ${peso(t((l) => l.ph_er))}`, t((l) => l.ph_ee.plus(l.ph_er)), "RA 11223 (Universal Health Care Act)"),
      step("Pag-IBIG (employee + employer)", `${peso(t((l) => l.hdmf_ee))} + ${peso(t((l) => l.hdmf_er))}`, t((l) => l.hdmf_ee.plus(l.hdmf_er)), "RA 9679 (HDMF Law)"),
      step("Total contributions to remit for the quarter", "SSS + PhilHealth + Pag-IBIG", total),
    ],
    schedule: {
      columns: [
        { key: "month", label: "Month" },
        { key: "name", label: "Employee" },
        { key: "sss", label: "SSS (EE + ER)", align: "right" },
        { key: "ph", label: "PhilHealth (EE + ER)", align: "right" },
        { key: "hdmf", label: "Pag-IBIG (EE + ER)", align: "right" },
      ],
      rows: ls.map((l) => ({ month: l.record.date.slice(0, 7), name: l.record.employee.name, sss: money(l.sss_ee.plus(l.sss_er)), ph: money(l.ph_ee.plus(l.ph_er)), hdmf: money(l.hdmf_ee.plus(l.hdmf_er)) })),
    },
    amount_payable: money(total),
    warnings: ["These are remitted to SSS, PhilHealth and Pag-IBIG, not the BIR, each with its own schedule and channel (due dates to be confirmed by Neil Priolo, CPA). The SSS employees' compensation (EC) contribution and WISP are not included."],
    rules_used: [...new Set(ls.flatMap((l) => l.rules_used))],
  });
}

function prepare1604C(ctx: Ctx, year: number): PreparedDocument {
  const yr = yearRange(year);
  const { employees } = payrollYear(ctx.input.records, year, ctx.rules);
  const t = (f: (e: (typeof employees)[number]) => Dec) => sum(employees.map(f));
  const gross = t((e) => e.basic.plus(e.benefits).plus(e.de_minimis));
  return doc(ctx, {
    id: `1604C-${year}`,
    form: "1604C",
    title: "Annual information return of taxes withheld on compensation, with the alphalist of employees",
    period_label: `Calendar year ${year}`,
    period_start: yr.start,
    period_end: yr.end,
    values: { total_compensation: money(gross), taxable_compensation: money(t((e) => e.taxable)), tax_due: money(t((e) => e.annual_tax)), tax_withheld: money(t((e) => e.withheld)) },
    steps: [
      step("Total compensation paid", employees.map((e) => peso(e.basic.plus(e.benefits).plus(e.de_minimis))).join(" + ") || "No payroll", gross),
      step("Total tax withheld (must equal the year's 1601C returns)", employees.map((e) => peso(e.withheld)).join(" + ") || "None", t((e) => e.withheld)),
    ],
    schedule: {
      columns: [
        { key: "tin", label: "TIN" },
        { key: "name", label: "Employee" },
        { key: "gross", label: "Gross compensation", align: "right" },
        { key: "nontax", label: "Non-taxable", align: "right" },
        { key: "taxable", label: "Taxable", align: "right" },
        { key: "due", label: "Tax due", align: "right" },
        { key: "withheld", label: "Tax withheld", align: "right" },
      ],
      rows: employees.map((e) => {
        const g = e.basic.plus(e.benefits).plus(e.de_minimis);
        return { tin: e.employee.tin ?? "", name: e.employee.name, gross: money(g), nontax: money(g.minus(e.taxable)), taxable: money(e.taxable), due: money(e.annual_tax), withheld: money(e.withheld) };
      }),
    },
    amount_payable: "0.00",
    warnings: ["The alphalist is submitted in the BIR's required data-file format (format to be confirmed); TaxGabay gives the list for now. Employees who qualify for substituted filing are marked by the CPA."],
    rules_used: [...new Set(employees.flatMap((e) => e.rules_used))],
  });
}

function prepare2316s(ctx: Ctx, year: number): PreparedDocument[] {
  const yr = yearRange(year);
  return payrollYear(ctx.input.records, year, ctx.rules).employees.map((e) => {
    const g = e.basic.plus(e.benefits).plus(e.de_minimis);
    return doc(ctx, {
      id: `2316-${year}-${employeeKey(e.employee).replace(/[^a-z0-9]+/g, "-")}`,
      form: "2316",
      title: `Certificate of compensation payment and tax withheld — ${e.employee.name}`,
      period_label: `Calendar year ${year}`,
      period_start: yr.start,
      period_end: yr.end,
      recipient: e.employee,
      values: { gross_compensation: money(g), non_taxable: money(g.minus(e.taxable)), taxable_compensation: money(e.taxable), tax_due: money(e.annual_tax), tax_withheld: money(e.withheld) },
      steps: e.minimum_wage_earner ? [step("Minimum wage earner — exempt", "Statutory minimum wage is exempt", "0", "NIRC Sec. 24(A)(2), as amended")] : e.steps.filter((x) => !/^Less tax withheld|^Balance|^Over-withheld/.test(x.label)),
      amount_payable: "0.00",
      warnings: [`Give this certificate to the employee (deadline to be confirmed by Neil Priolo, CPA).${e.employee.tin ? "" : " Add the employee's TIN first."}`],
      rules_used: e.rules_used,
    });
  });
}

// ---------- Percentage tax (2551Q) ----------

function prepare2551Q(ctx: Ctx, range: Range, label: string): PreparedDocument {
  const gross = sum(salesIn(ctx.input.records, range).map((s) => s.amount));
  const r = computePercentageTax({ period_end: range.end, gross_sales_receipts: money(gross) }, ctx.rules);
  return doc(ctx, {
    id: `2551Q-${range.end}`,
    form: "2551Q",
    title: "Quarterly percentage tax return",
    period_label: label,
    period_start: range.start,
    period_end: range.end,
    values: { gross_sales: money(gross), rate: r.result.rate, tax_due: r.result.tax_due, payable: r.result.tax_due },
    steps: r.steps,
    amount_payable: r.result.tax_due,
    warnings: r.warnings,
    rules_used: r.rules_used,
  });
}

// ---------- Expanded withholding: 0619E, 1601EQ, QAP, 2307 ----------

interface Withheld {
  expense: ExpenseRecord;
  atc: string;
  base: string;
  rate: string;
  ewt: string;
  rule_ids: string[];
}

function withheldIn(ctx: Ctx, range: Range): Withheld[] {
  const out: Withheld[] = [];
  for (const e of expensesIn(ctx.input.records, range)) {
    if (!e.withholding) continue;
    try {
      const r = computeEwt({ atc: e.withholding.atc, payment_date: e.date, amount: e.amount, vat_inclusive: !!e.supplier_vat_registered }, ctx.rules);
      out.push({ expense: e, atc: e.withholding.atc, base: r.result.tax_base, rate: r.result.rate, ewt: r.result.ewt, rule_ids: r.rules_used });
    } catch {
      // Unknown ATC: already reported by checkRecords.
    }
  }
  return out;
}

function prepare0619E(ctx: Ctx, month: Range): PreparedDocument {
  const w = withheldIn(ctx, month);
  const total = sum(w.map((x) => x.ewt));
  const steps = w.map((x) => step(`${x.expense.supplier.name} (${x.atc})`, `${peso(x.base)} × ${dec(x.rate).times(100).toString()}%`, x.ewt, "RR 2-98 Sec. 2.57.2, as amended"));
  steps.push(step("Total expanded withholding tax to remit", w.length ? w.map((x) => peso(x.ewt)).join(" + ") : "No tax withheld this month", total));
  return doc(ctx, {
    id: `0619E-${month.end}`,
    form: "0619E",
    title: "Monthly remittance of expanded withholding tax",
    period_label: monthLabel(month),
    period_start: month.start,
    period_end: month.end,
    values: { total_withheld: money(total), payable: money(total) },
    steps,
    amount_payable: money(total),
    warnings: w.length ? [] : ["Nothing was withheld this month. Ask Neil Priolo, CPA whether a zero 0619E still has to be filed for your registration."],
    rules_used: [...new Set(w.flatMap((x) => x.rule_ids))],
  });
}

function byAtc(w: readonly Withheld[]) {
  const m = new Map<string, { atc: string; base: Dec; ewt: Dec; rate: string }>();
  for (const x of w) {
    const cur = m.get(x.atc) ?? { atc: x.atc, base: dec(0), ewt: dec(0), rate: x.rate };
    cur.base = cur.base.plus(x.base);
    cur.ewt = cur.ewt.plus(x.ewt);
    m.set(x.atc, cur);
  }
  return [...m.values()].sort((a, b) => a.atc.localeCompare(b.atc));
}

function prepare1601EQ(ctx: Ctx, q: QuarterRef, range: Range): PreparedDocument {
  const [m1, m2] = quarterMonths(q) as [Range, Range, Range];
  const w = withheldIn(ctx, range);
  const total = sum(w.map((x) => x.ewt));
  const r1 = sum(withheldIn(ctx, m1).map((x) => x.ewt));
  const r2 = sum(withheldIn(ctx, m2).map((x) => x.ewt));
  const payable = total.minus(r1).minus(r2);
  const atcs = byAtc(w);
  return doc(ctx, {
    id: `1601EQ-${range.end}`,
    form: "1601EQ",
    title: "Quarterly remittance return of expanded withholding tax",
    period_label: quarterLabel(q),
    period_start: range.start,
    period_end: range.end,
    values: { total_withheld: money(total), remitted_month1: money(r1), remitted_month2: money(r2), payable: money(payable) },
    steps: [
      ...atcs.map((a) => step(`Tax withheld under ${a.atc}`, `${dec(a.rate).times(100).toString()}% × ${peso(a.base)}`, a.ewt, "RR 2-98 Sec. 2.57.2, as amended")),
      step("Total taxes withheld for the quarter", atcs.map((a) => peso(a.ewt)).join(" + ") || "None", total),
      step("Less: remitted with the 0619E for the first and second months", `${peso(r1)} + ${peso(r2)}`, r1.plus(r2)),
      step("Tax still due for the quarter", `${peso(total)} − ${peso(r1.plus(r2))}`, payable),
    ],
    schedule: {
      columns: [
        { key: "atc", label: "ATC" },
        { key: "base", label: "Tax base", align: "right" },
        { key: "rate", label: "Rate", align: "right" },
        { key: "ewt", label: "Tax withheld", align: "right" },
      ],
      rows: atcs.map((a) => ({ atc: a.atc, base: money(a.base), rate: `${dec(a.rate).times(100).toString()}%`, ewt: money(a.ewt) })),
    },
    amount_payable: money(max0(payable)),
    warnings: ["Assumes the 0619E for the first two months were remitted as prepared by TaxGabay. Adjust if the amounts actually paid differ."],
    rules_used: [...new Set(w.flatMap((x) => x.rule_ids))],
  });
}

const payeeKey = (p: Party) => `${(p.tin ?? "").replace(/\D/g, "")}|${p.name.trim().toLowerCase()}`;

function payees(ctx: Ctx, q: QuarterRef, range: Range) {
  const months = quarterMonths(q);
  const m = new Map<string, { payee: Party; atc: string; byMonth: [Dec, Dec, Dec]; ewt: Dec; rate: string; rule_ids: Set<string> }>();
  for (const x of withheldIn(ctx, range)) {
    const k = `${payeeKey(x.expense.supplier)}|${x.atc}`;
    const cur = m.get(k) ?? { payee: x.expense.supplier, atc: x.atc, byMonth: [dec(0), dec(0), dec(0)], ewt: dec(0), rate: x.rate, rule_ids: new Set<string>() };
    const i = months.findIndex((mm) => inRange(x.expense.date, mm));
    cur.byMonth[i] = cur.byMonth[i]!.plus(x.base);
    cur.ewt = cur.ewt.plus(x.ewt);
    x.rule_ids.forEach((id) => cur.rule_ids.add(id));
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => a.payee.name.localeCompare(b.payee.name) || a.atc.localeCompare(b.atc));
}

function prepareQap(ctx: Ctx, q: QuarterRef, range: Range): PreparedDocument {
  const list = payees(ctx, q, range);
  return doc(ctx, {
    id: `QAP-${range.end}`,
    form: "QAP",
    title: "Quarterly alphalist of payees (attachment to 1601EQ)",
    period_label: quarterLabel(q),
    period_start: range.start,
    period_end: range.end,
    values: {},
    steps: [step("Total tax withheld (must equal the 1601EQ)", list.map((p) => peso(p.ewt)).join(" + ") || "None", sum(list.map((p) => p.ewt)))],
    schedule: {
      columns: [
        { key: "tin", label: "TIN" },
        { key: "name", label: "Payee" },
        { key: "atc", label: "ATC" },
        { key: "income", label: "Income payment", align: "right" },
        { key: "rate", label: "Rate", align: "right" },
        { key: "ewt", label: "Tax withheld", align: "right" },
      ],
      rows: list.map((p) => ({ tin: p.payee.tin ?? "", name: p.payee.name, atc: p.atc, income: money(sum(p.byMonth)), rate: `${dec(p.rate).times(100).toString()}%`, ewt: money(p.ewt) })),
    },
    amount_payable: "0.00",
    warnings: ["Submit the QAP in the BIR's required data-file format; TaxGabay gives the list for now (file format pending CPA confirmation)."],
    rules_used: [...new Set(list.flatMap((p) => [...p.rule_ids]))],
  });
}

function prepare2307s(ctx: Ctx, q: QuarterRef, range: Range): PreparedDocument[] {
  return payees(ctx, q, range).map((p, i) => {
    const total = sum(p.byMonth);
    return doc(ctx, {
      id: `2307-${range.end}-${i + 1}`,
      form: "2307",
      title: `Certificate of creditable tax withheld — ${p.payee.name}`,
      period_label: quarterLabel(q),
      period_start: range.start,
      period_end: range.end,
      recipient: p.payee,
      values: { income_month1: money(p.byMonth[0]), income_month2: money(p.byMonth[1]), income_month3: money(p.byMonth[2]), total_income: money(total), tax_withheld: money(p.ewt) },
      steps: [step(`Tax withheld (${p.atc})`, `${dec(p.rate).times(100).toString()}% × ${peso(total)}`, p.ewt, "RR 2-98 Sec. 2.58, as amended")],
      amount_payable: "0.00",
      warnings: p.payee.tin ? [] : ["The payee's TIN is missing; add it before giving out the certificate."],
      rules_used: [...p.rule_ids],
    });
  });
}

// ---------- SAWT ----------

function prepareSawt(ctx: Ctx, q: QuarterRef, range: Range): PreparedDocument {
  const certs = certsIn(ctx.input.records, range).sort((a, b) => a.payor.name.localeCompare(b.payor.name));
  return doc(ctx, {
    id: `SAWT-${range.end}`,
    form: "SAWT",
    title: "Summary alphalist of withholding taxes (attachment to 1701Q / 2551Q)",
    period_label: quarterLabel(q),
    period_start: range.start,
    period_end: range.end,
    values: {},
    steps: [step("Total creditable tax withheld per Forms 2307", certs.map((c) => peso(c.tax_withheld)).join(" + ") || "None", sum(certs.map((c) => c.tax_withheld)))],
    schedule: {
      columns: [
        { key: "tin", label: "Payor TIN" },
        { key: "name", label: "Payor (withholding agent)" },
        { key: "atc", label: "ATC" },
        { key: "income", label: "Income payment", align: "right" },
        { key: "tax", label: "Tax withheld", align: "right" },
      ],
      rows: certs.map((c) => ({ tin: c.payor.tin ?? "", name: c.payor.name, atc: c.atc, income: money(c.income_payment), tax: money(c.tax_withheld) })),
    },
    amount_payable: "0.00",
    warnings: ["Submit the SAWT in the BIR's required data-file format; TaxGabay gives the list for now (file format pending CPA confirmation)."],
    rules_used: [],
  });
}

// ---------- Income tax: 1701Q (cumulative) and 1701A ----------

type ItOption = "eight_percent" | "graduated_osd" | "graduated_itemized";

interface ItComputation {
  gross: Dec;
  deduction: Dec;
  taxable: Dec;
  tax: Dec;
  steps: Step[];
  rules_used: string[];
  warnings: string[];
}

/**
 * Income tax to date. Mixed-income earners: the 1701Q covers business income only (8% with no
 * ₱250,000 reduction); the annual 1701 adds the compensation from Forms 2316 (`withCompensation`).
 */
function incomeTaxTo(ctx: Ctx, year: number, end: ISODate, option: ItOption, withCompensation = false): ItComputation | null {
  const r: Range = { start: `${year}-01-01`, end };
  const gross = sum(salesIn(ctx.input.records, r).map((s) => saleNet(ctx, s)));
  const payrollCost = () => {
    const { lines } = payrollYear(ctx.input.records, year, ctx.rules);
    return sum(lines.filter((l) => l.record.date <= end).map((l) => l.basic.plus(l.benefits).plus(l.de_minimis).plus(l.sss_er).plus(l.ph_er).plus(l.hdmf_er)));
  };
  const itemized = option === "graduated_itemized" ? money(sum(expensesIn(ctx.input.records, r).filter((e) => e.category !== "equipment").map((e) => expenseSplit(ctx, e).net)).plus(payrollIn(ctx.input.records, year).length ? payrollCost() : dec(0)).plus(depreciationIn(ctx, r))) : undefined;
  if (gross.isZero()) {
    return { gross, deduction: dec(0), taxable: dec(0), tax: dec(0), steps: [step("Gross sales/receipts to date", "No sales recorded yet", "0")], rules_used: [], warnings: ["No sales are recorded for the year so far."] };
  }
  const mixed = isMixed(ctx);
  if (mixed && option === "eight_percent" && !withCompensation) {
    const rule = findRule<{ rate: string }>(ctx.rules, "income_tax.individual.eight_percent", `${year}-12-31`, { category: "individual" });
    const tax = round2(gross.times(rule.value.rate));
    return {
      gross,
      deduction: dec(0),
      taxable: gross,
      tax,
      steps: [step("Gross sales/receipts to date", "Total of sales records", gross), step("Income tax at 8% (no ₱250,000 reduction for mixed-income earners)", `${dec(rule.value.rate).times(100).toString()}% × ${peso(gross)}`, tax, rule.legal_basis)],
      rules_used: [rule.id],
      warnings: [],
    };
  }
  const comp = withCompensation && mixed ? sum(certs2316(ctx, year).map((c) => c.taxable_compensation)) : dec(0);
  const calc = computeIndividualIncomeTax({ taxable_year: year, compensation_income: money(comp), gross_sales_receipts: money(gross), itemized_deductions: itemized, vat_registered: isVatClient(ctx) }, ctx.rules);
  const opt = calc.result.options.find((o) => o.key === option)!;
  if (!opt.eligible) {
    ctx.issues.push({ code: "option_ineligible", severity: "error", message: `The income tax option on the profile cannot be used: ${opt.ineligible_reasons.join(" ")}` });
    return null;
  }
  let taxable: Dec;
  if (option === "eight_percent") {
    const rule = findRule<{ purely_self_employed_deduction: string }>(ctx.rules, "income_tax.individual.eight_percent", `${year}-12-31`, { category: "individual" });
    taxable = mixed ? gross : max0(gross.minus(rule.value.purely_self_employed_deduction));
  } else {
    taxable = dec(opt.steps.find((s) => s.label === "Taxable income from business")!.amount);
  }
  return {
    gross,
    deduction: gross.minus(taxable),
    taxable,
    tax: dec(opt.income_tax),
    steps: opt.steps.filter((s) => !/^Percentage tax|^Total tax$/.test(s.label)),
    rules_used: calc.rules_used,
    warnings: mixed && !withCompensation ? [...calc.warnings, "Mixed-income earner on graduated rates: the 1701Q here taxes business income alone on the graduated table; compensation is added in the annual 1701 (method to confirm with Neil Priolo, CPA)."] : calc.warnings,
  };
}

const isMixed = (ctx: Ctx) => ctx.input.client.profile.taxpayer_type === "mixed_income";
const certs2316 = (ctx: Ctx, year: number) => ctx.input.records.filter((r): r is Form2316Received => r.kind === "form_2316_received" && r.year === year);

const cwtTo = (ctx: Ctx, year: number, end: ISODate) => sum(certsIn(ctx.input.records, { start: `${year}-01-01`, end }).map((c) => c.tax_withheld));

/** Tax paid with each 1701Q of the year up to (not including) quarter `upTo`, assuming each was paid as prepared. */
function priorQuarterPayments(ctx: Ctx, year: number, upTo: number, option: ItOption): Dec {
  let paid = dec(0);
  for (let k = 1; k < upTo; k++) {
    const it = incomeTaxTo(ctx, year, quarterRange({ year, quarter: k as 1 | 2 | 3 }).end, option);
    if (!it) return paid;
    paid = paid.plus(max0(it.tax.minus(cwtTo(ctx, year, quarterRange({ year, quarter: k as 1 | 2 | 3 }).end)).minus(paid)));
  }
  return paid;
}

function prepare1701Q(ctx: Ctx, q: QuarterRef, range: Range, option: ItOption): PreparedDocument | null {
  const it = incomeTaxTo(ctx, q.year, range.end, option);
  if (!it) return null;
  const prior = priorQuarterPayments(ctx, q.year, q.quarter, option);
  const cwt = cwtTo(ctx, q.year, range.end);
  const payable = round2(it.tax.minus(prior).minus(cwt));
  return doc(ctx, {
    id: `1701Q-${range.end}`,
    form: "1701Q",
    title: "Quarterly income tax return",
    period_label: `${quarterLabel(q)} (cumulative from 1 January)`,
    period_start: `${q.year}-01-01`,
    period_end: range.end,
    values: {
      gross_cumulative: money(it.gross),
      deductions: money(it.deduction),
      taxable_income: money(it.taxable),
      tax_due: money(it.tax),
      prior_payments: money(prior),
      cwt: money(cwt),
      payable: money(payable),
    },
    steps: [
      ...it.steps,
      step("Less: tax paid with earlier 1701Q returns this year", "As prepared by TaxGabay for earlier quarters", prior, "NIRC Sec. 74"),
      step("Less: creditable tax withheld (Forms 2307, to date)", "Total of Forms 2307 received", cwt, "NIRC Sec. 58; RR 2-98"),
      step(payable.isNegative() ? "Overpayment, carried to the next quarter" : "Income tax payable", `${peso(it.tax)} − ${peso(prior)} − ${peso(cwt)}`, payable.abs()),
    ],
    amount_payable: money(max0(payable)),
    warnings: [...it.warnings, "Uses sales recorded by invoice date. If you report income when collected, confirm with Neil Priolo, CPA."],
    rules_used: it.rules_used,
  });
}

function prepare1701A(ctx: Ctx, year: number, option: ItOption): PreparedDocument | null {
  const yr = yearRange(year);
  const mixed = isMixed(ctx);
  const it = incomeTaxTo(ctx, year, yr.end, option, true);
  if (!it) return null;
  const quarterly = priorQuarterPayments(ctx, year, 4, option);
  const cwt = cwtTo(ctx, year, yr.end);
  const c2316 = mixed ? certs2316(ctx, year) : [];
  const comp = sum(c2316.map((c) => c.taxable_compensation));
  const compWithheld = sum(c2316.map((c) => c.tax_withheld));
  const payable = round2(it.tax.minus(compWithheld).minus(quarterly).minus(cwt));
  const itemized = option === "graduated_itemized" || mixed;
  if (mixed && !c2316.length) ctx.issues.push({ code: "missing_2316", severity: "warning", message: `No Form 2316 is recorded for ${year}. Add the 2316 from each employer so the annual return includes the compensation income.` });
  return doc(ctx, {
    id: `${itemized ? "1701" : "1701A"}-${year}`,
    form: itemized ? "1701" : "1701A",
    title: mixed ? "Annual income tax return (mixed income: compensation and business)" : itemized ? "Annual income tax return (individuals, itemized deductions)" : "Annual income tax return (purely business or profession, 8% or OSD)",
    period_label: `Taxable year ${year}`,
    period_start: yr.start,
    period_end: yr.end,
    values: {
      ...(mixed ? { taxable_compensation: money(comp), compensation_withheld: money(compWithheld) } : {}),
      gross: money(it.gross),
      deductions: money(it.deduction),
      taxable_income: money(it.taxable),
      tax_due: money(it.tax),
      quarterly_payments: money(quarterly),
      cwt: money(cwt),
      payable: money(payable),
    },
    steps: [
      ...it.steps,
      ...(mixed ? [step("Less: tax withheld on compensation (Forms 2316)", c2316.map((c) => `${c.employer.name} ${peso(c.tax_withheld)}`).join(" + ") || "None recorded", compWithheld, "NIRC Sec. 79")] : []),
      step("Less: tax paid with the 1701Q returns", "As prepared by TaxGabay for Q1–Q3", quarterly, "NIRC Sec. 74"),
      step("Less: creditable tax withheld (Forms 2307 for the year)", "Total of Forms 2307 received", cwt, "NIRC Sec. 58; RR 2-98"),
      step(payable.isNegative() ? "Overpayment (choose refund, tax credit certificate or carry-over on the return)" : "Income tax payable", `${peso(it.tax)}${mixed ? ` − ${peso(compWithheld)}` : ""} − ${peso(quarterly)} − ${peso(cwt)}`, payable.abs()),
    ],
    amount_payable: money(max0(payable)),
    warnings: itemized ? [...it.warnings, "Attach the financial statements (audited where gross sales exceed the threshold), and the schedule of itemized deductions."] : it.warnings,
    rules_used: it.rules_used,
  });
}

// ---------- Corporate income tax: 1702Q (cumulative) and 1702-RT ----------

const CORPORATE_TYPES = new Set(["corporation", "opc", "partnership"]);

interface CitComputation {
  sales: Dec;
  cos: Dec;
  gross: Dec;
  deductions: Dec;
  taxable: Dec;
  rcit: Dec;
  mcit: Dec;
  tax: Dec;
  steps: Step[];
  rules_used: string[];
  warnings: string[];
}

function corporateTaxTo(ctx: Ctx, year: number, end: ISODate): CitComputation | null {
  const corp = ctx.input.client.corporate ?? {};
  if (!corp.year_commenced) {
    if (!ctx.issues.some((i) => i.code === "year_commenced")) ctx.issues.push({ code: "year_commenced", severity: "error", message: "Enter the year the business started operations (needed for the minimum corporate income tax) before income tax returns can be prepared." });
    return null;
  }
  const r: Range = { start: `${year}-01-01`, end };
  const sales = sum(salesIn(ctx.input.records, r).map((s) => saleNet(ctx, s)));
  const exps = expensesIn(ctx.input.records, r);
  const cos = sum(exps.filter((e) => e.category === "cost_of_sales").map((e) => expenseSplit(ctx, e).net));
  const { lines } = payrollYear(ctx.input.records, year, ctx.rules);
  const payroll = sum(lines.filter((l) => l.record.date <= end).map((l) => l.basic.plus(l.benefits).plus(l.de_minimis).plus(l.sss_er).plus(l.ph_er).plus(l.hdmf_er)));
  const deductions = sum(exps.filter((e) => e.category !== "cost_of_sales" && e.category !== "equipment").map((e) => expenseSplit(ctx, e).net)).plus(payroll).plus(depreciationIn(ctx, r));
  const assetsKnown = !!corp.total_assets_excl_land;
  const c = computeCorporateIncomeTax(
    { taxable_year_end: `${year}-12-31`, year_commenced: corp.year_commenced, gross_sales: money(sales), cost_of_sales: money(cos), deductions: money(deductions), total_assets_excl_land: assetsKnown ? corp.total_assets_excl_land! : "999999999999" },
    ctx.rules,
  );
  const warnings = [...c.warnings];
  if (!assetsKnown) warnings.push("Total assets (excluding land) were not entered, so the regular rate is used. Enter them to check whether the reduced rate applies.");
  return {
    sales,
    cos,
    gross: dec(c.result.gross_income),
    deductions,
    taxable: dec(c.result.taxable_income),
    rcit: dec(c.result.rcit),
    mcit: dec(c.result.mcit),
    tax: dec(c.result.tax_due),
    steps: [step("Sales, net of VAT where applicable", "Total of sales records", sales), step("Less: cost of sales", "Expenses marked as goods for resale / cost of sales", cos), step("Allowable deductions", "Other expenses (net of input VAT, equipment excluded), payroll costs with employer contributions, and depreciation journal entries", deductions, "NIRC Sec. 34"), ...c.steps],
    rules_used: c.rules_used,
    warnings,
  };
}

function priorCorporatePayments(ctx: Ctx, year: number, upTo: number): Dec {
  let paid = dec(0);
  for (let k = 1; k < upTo; k++) {
    const end = quarterRange({ year, quarter: k as 1 | 2 | 3 }).end;
    const c = corporateTaxTo(ctx, year, end);
    if (!c) return paid;
    paid = paid.plus(max0(c.tax.minus(cwtTo(ctx, year, end)).minus(paid)));
  }
  return paid;
}

function prepareCorporate(ctx: Ctx, q: QuarterRef, annual: boolean): PreparedDocument | null {
  const end = annual ? `${q.year}-12-31` : quarterRange(q).end;
  const c = corporateTaxTo(ctx, q.year, end);
  if (!c) return null;
  const prior = priorCorporatePayments(ctx, q.year, annual ? 4 : q.quarter);
  const cwt = cwtTo(ctx, q.year, end);
  const payable = round2(c.tax.minus(prior).minus(cwt));
  const form = annual ? "1702-RT" : "1702Q";
  return doc(ctx, {
    id: `${form}-${end}`,
    form,
    title: annual ? "Annual income tax return (corporations and partnerships, regular rate)" : "Quarterly income tax return (corporations and partnerships)",
    period_label: annual ? `Taxable year ${q.year}` : `${quarterLabel(q)} (cumulative from 1 January)`,
    period_start: `${q.year}-01-01`,
    period_end: end,
    values: {
      sales: money(c.sales),
      cost_of_sales: money(c.cos),
      gross_income: money(c.gross),
      deductions: money(c.deductions),
      taxable_income: money(c.taxable),
      rcit: money(c.rcit),
      mcit: money(c.mcit),
      tax_due: money(c.tax),
      prior_payments: money(prior),
      cwt: money(cwt),
      payable: money(payable),
    },
    steps: [
      ...c.steps,
      step(annual ? "Less: tax paid with the 1702Q returns" : "Less: tax paid with earlier 1702Q returns this year", "As prepared by TaxGabay for earlier quarters", prior, "NIRC Sec. 75"),
      step("Less: creditable tax withheld (Forms 2307)", "Total of Forms 2307 received", cwt, "NIRC Sec. 58; RR 2-98"),
      step(payable.isNegative() ? (annual ? "Overpayment (choose refund, tax credit certificate or carry-over on the return)" : "Overpayment, carried to the next quarter") : "Income tax payable", `${peso(c.tax)} − ${peso(prior)} − ${peso(cwt)}`, payable.abs()),
    ],
    amount_payable: money(max0(payable)),
    warnings: [...c.warnings, "Excess MCIT from earlier years, net operating loss carry-over (NOLCO) and income subject to final tax are not modeled; Neil Priolo, CPA adds them if they apply.", ...(annual ? ["Attach audited financial statements where required."] : [])],
    rules_used: c.rules_used,
  });
}

// ---------- Packet ----------

/**
 * Prepares every document a non-VAT individual (self-employed or sole proprietor) must file for
 * a quarter, from the client's records. Quarter 4 also prepares the annual 1701A. Documents are
 * for the client to review, sign and file; nothing is filed by TaxGabay.
 */
export function preparePacket(input: PrepareInput): Packet {
  const rules = input.rules ?? taxRules;
  const profile = input.client.profile;
  const q = input.period;
  const range = quarterRange(q);
  const issues = checkRecords(input.records, q, rules, { vat: profile.vat_status === "vat", hasEmployees: profile.has_employees });
  const obligations = generateObligations(profile, {
    from: range.start,
    to: addMonths(range.end, 6),
    rules: input.deadlines ?? deadlineRules,
    holidays: input.holidayList ?? holidays,
    extensions: deadlineExtensions,
  });
  const ctx: Ctx = {
    input,
    rules,
    issues,
    due: (form, end) => {
      const o = obligations.find((x) => x.form_code === form && x.period_end === end);
      return o ? { date: o.due_date, needs_verification: o.needs_verification } : null;
    },
  };
  const documents: PreparedDocument[] = [];
  const notSupported: Packet["not_supported"] = [];

  const individual = profile.taxpayer_type === "self_employed" || profile.taxpayer_type === "sole_proprietorship" || profile.taxpayer_type === "mixed_income";
  const corporate = CORPORATE_TYPES.has(profile.taxpayer_type) && profile.fiscal_year_end_month === 12;
  if (!individual && !corporate) {
    notSupported.push({
      form: "—",
      reason: CORPORATE_TYPES.has(profile.taxpayer_type) ? "Corporations with a fiscal year (not ending in December) are planned for a later batch." : "Supported: self-employed individuals, sole proprietors, mixed-income earners, and corporations, OPCs and partnerships on a calendar year.",
    });
  }
  if (corporate && profile.taxpayer_type === "partnership") issues.push({ code: "partnership_type", severity: "warning", message: "General professional partnerships are not subject to income tax (partners are taxed instead). These returns assume a taxable partnership — confirm with Neil Priolo, CPA." });

  const option = profile.income_tax_option;
  const itOption: ItOption | null = option === "eight_percent" || option === "graduated_osd" || option === "graduated_itemized" ? option : null;
  if (individual && !itOption) issues.push({ code: "income_tax_option", severity: "error", message: "Choose the income tax option (8%, graduated with OSD, or graduated with itemized deductions) in the client's profile before income tax returns can be prepared." });

  if (input.month !== undefined && (individual || corporate)) {
    const months = quarterMonths(q);
    const m = months.find((x) => Number(x.start.slice(5, 7)) === input.month);
    if (!m) throw new Error(`Month ${input.month} is not in ${quarterLabel(q)}.`);
    const quarterEnd = m === months[2];
    if (profile.withholds_expanded && !quarterEnd) documents.push(prepare0619E(ctx, m));
    if (profile.has_employees) documents.push(prepare1601C(ctx, m), prepareContributions(ctx, q, m, monthLabel(m)));
    if (!documents.length) notSupported.push({ form: "—", reason: quarterEnd ? "The quarter's last month is filed with the quarterly packet." : "Nothing is filed monthly for this client (no employees and no expanded withholding)." });
    return {
      client: input.client.name,
      period: q,
      month: input.month,
      period_label: monthLabel(m),
      issues: issues.filter((i) => i.code !== "no_sales_month"),
      documents,
      total_payable: money(sum(documents.map((d) => d.amount_payable))),
      not_supported: notSupported,
    };
  }

  if (individual || corporate) {
    if (profile.vat_status === "vat") documents.push(prepare2550Q(ctx, q, range), prepareSalesList(ctx, q, range), preparePurchaseList(ctx, q, range));
    else if (corporate || itOption !== "eight_percent") documents.push(prepare2551Q(ctx, range, quarterLabel(q)));
    if (profile.withholds_expanded) {
      const [m1, m2] = quarterMonths(q) as [Range, Range, Range];
      documents.push(prepare0619E(ctx, m1), prepare0619E(ctx, m2), prepare1601EQ(ctx, q, range), prepareQap(ctx, q, range), ...prepare2307s(ctx, q, range));
    }
    if (profile.has_employees) {
      documents.push(...quarterMonths(q).map((m) => prepare1601C(ctx, m)), prepareContributions(ctx, q, range));
      if (q.quarter === 4) documents.push(prepare1604C(ctx, q.year), ...prepare2316s(ctx, q.year));
    }
    if (certsIn(input.records, range).length) documents.push(prepareSawt(ctx, q, range));
    if (corporate) {
      const d = prepareCorporate(ctx, q, q.quarter === 4);
      if (d) documents.push(d);
    } else if (itOption) {
      if (q.quarter < 4) {
        const d = prepare1701Q(ctx, q, range, itOption);
        if (d) documents.push(d);
      } else {
        const d = prepare1701A(ctx, q.year, itOption);
        if (d) documents.push(d);
      }
    }
  }

  return {
    client: input.client.name,
    period: q,
    period_label: quarterLabel(q),
    issues,
    documents,
    total_payable: money(sum(documents.map((d) => d.amount_payable))),
    not_supported: notSupported,
  };
}

/** The default rule set, for callers that need it alongside the engine. */
export const taxRulesFor = (): readonly TaxRule[] => taxRules;
