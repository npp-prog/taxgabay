import {
  addMonths,
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
  taxRules,
  type Dec,
  type DeadlineRule,
  type Holiday,
  type ISODate,
  type Step,
  type TaxRule,
} from "@taxgabay/tax-engine";
import { checkRecords } from "./checks";
import { linesFor } from "./data/form-lines";
import { inRange, monthLabel, quarterLabel, quarterMonths, quarterRange, yearRange, type Range } from "./periods";
import type { ClientInfo, ClientRecord, ExpenseRecord, Form2307Received, Issue, Packet, Party, PreparedDocument, PreparedField, QuarterRef, SaleRecord } from "./types";

export interface PrepareInput {
  client: ClientInfo;
  records: readonly ClientRecord[];
  period: QuarterRef;
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

function incomeTaxTo(ctx: Ctx, year: number, end: ISODate, option: ItOption): ItComputation | null {
  const r: Range = { start: `${year}-01-01`, end };
  const gross = sum(salesIn(ctx.input.records, r).map((s) => s.amount));
  const itemized = option === "graduated_itemized" ? money(sum(expensesIn(ctx.input.records, r).map((e) => e.amount))) : undefined;
  const calc = computeIndividualIncomeTax({ taxable_year: year, gross_sales_receipts: money(gross), itemized_deductions: itemized, vat_registered: false }, ctx.rules);
  const opt = calc.result.options.find((o) => o.key === option)!;
  if (!opt.eligible) {
    ctx.issues.push({ code: "option_ineligible", severity: "error", message: `The income tax option on the profile cannot be used: ${opt.ineligible_reasons.join(" ")}` });
    return null;
  }
  let taxable: Dec;
  if (option === "eight_percent") {
    const rule = findRule<{ purely_self_employed_deduction: string }>(ctx.rules, "income_tax.individual.eight_percent", `${year}-12-31`, { category: "individual" });
    taxable = max0(gross.minus(rule.value.purely_self_employed_deduction));
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
    warnings: calc.warnings,
  };
}

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
  const it = incomeTaxTo(ctx, year, yr.end, option);
  if (!it) return null;
  const quarterly = priorQuarterPayments(ctx, year, 4, option);
  const cwt = cwtTo(ctx, year, yr.end);
  const payable = round2(it.tax.minus(quarterly).minus(cwt));
  return doc(ctx, {
    id: `1701A-${year}`,
    form: "1701A",
    title: "Annual income tax return (purely business or profession, 8% or OSD)",
    period_label: `Taxable year ${year}`,
    period_start: yr.start,
    period_end: yr.end,
    values: {
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
      step("Less: tax paid with the 1701Q returns", "As prepared by TaxGabay for Q1–Q3", quarterly, "NIRC Sec. 74"),
      step("Less: creditable tax withheld (Forms 2307 for the year)", "Total of Forms 2307 received", cwt, "NIRC Sec. 58; RR 2-98"),
      step(payable.isNegative() ? "Overpayment (choose refund, tax credit certificate or carry-over on the return)" : "Income tax payable", `${peso(it.tax)} − ${peso(quarterly)} − ${peso(cwt)}`, payable.abs()),
    ],
    amount_payable: money(max0(payable)),
    warnings: it.warnings,
    rules_used: it.rules_used,
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
  const issues = checkRecords(input.records, q, rules);
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

  const individual = profile.taxpayer_type === "self_employed" || profile.taxpayer_type === "sole_proprietorship";
  if (!individual) notSupported.push({ form: "—", reason: "Only self-employed individuals and sole proprietors are supported in this first batch." });
  if (profile.vat_status === "vat") notSupported.push({ form: "2550Q", reason: "VAT returns are planned for the next batch." });
  if (profile.has_employees) notSupported.push({ form: "1601C", reason: "Payroll returns (1601C, 1604C, 2316) are planned for a later batch." });

  const option = profile.income_tax_option;
  const itOption: ItOption | null = option === "eight_percent" || option === "graduated_osd" || option === "graduated_itemized" ? option : null;
  if (individual && !itOption) issues.push({ code: "income_tax_option", severity: "error", message: "Choose the income tax option (8%, graduated with OSD, or graduated with itemized deductions) in the client's profile before income tax returns can be prepared." });

  if (individual && profile.vat_status !== "vat") {
    if (itOption !== "eight_percent") documents.push(prepare2551Q(ctx, range, quarterLabel(q)));
    if (profile.withholds_expanded) {
      const [m1, m2] = quarterMonths(q) as [Range, Range, Range];
      documents.push(prepare0619E(ctx, m1), prepare0619E(ctx, m2), prepare1601EQ(ctx, q, range), prepareQap(ctx, q, range), ...prepare2307s(ctx, q, range));
    }
    if (certsIn(input.records, range).length) documents.push(prepareSawt(ctx, q, range));
    if (itOption) {
      if (q.quarter < 4) {
        const d = prepare1701Q(ctx, q, range, itOption);
        if (d) documents.push(d);
      } else if (itOption === "graduated_itemized") {
        notSupported.push({ form: "1701", reason: "Itemized deductions are filed on the 1701 (not the 1701A), planned for a later batch." });
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
