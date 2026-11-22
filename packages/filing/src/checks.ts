import { dec, findRule, peso, round2, type TaxRule } from "@taxgabay/tax-engine";
import { inRange, monthLabel, quarterMonths, quarterRange } from "./periods";
import { journalProblem } from "./books";
import type { ClientRecord, ExpenseRecord, Form2307Received, Issue, PayrollRecord, QuarterRef, SaleRecord } from "./types";

const isSale = (r: ClientRecord): r is SaleRecord => r.kind === "sale";
const isExpense = (r: ClientRecord): r is ExpenseRecord => r.kind === "expense";
const is2307 = (r: ClientRecord): r is Form2307Received => r.kind === "form_2307_received";
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function atcRule(rules: readonly TaxRule[], atc: string, on: string) {
  try {
    return findRule<{ rate: string }>(rules, `ewt.atc.${atc}`, on);
  } catch {
    return null;
  }
}

/**
 * Checks a client's records for one quarter before documents are prepared. Errors block
 * preparation of the affected document; warnings are shown to the client and the reviewer.
 */
export function checkRecords(records: readonly ClientRecord[], q: QuarterRef, rules: readonly TaxRule[], opts: { vat?: boolean; hasEmployees?: boolean } = {}): Issue[] {
  const issues: Issue[] = [];
  const range = quarterRange(q);
  const inQ = records.filter((r) => inRange(r.date, range));

  for (const r of records) {
    if (r.kind === "journal") {
      const problem = journalProblem(r);
      if (problem) issues.push({ code: "invalid_journal", severity: "error", message: `Journal entry "${r.memo}" (${r.date}): ${problem}`, record_id: r.id });
      continue;
    }
    const amount = r.kind === "form_2307_received" ? r.income_payment : r.kind === "payroll" ? r.basic_pay : r.amount;
    let ok: boolean;
    try {
      ok = dec(amount).greaterThan(0);
    } catch {
      ok = false;
    }
    if (!ok) issues.push({ code: "invalid_amount", severity: "error", message: `Record ${r.id}: the amount must be a number greater than zero.`, record_id: r.id });
  }

  // Sales: duplicate and missing invoice numbers.
  const sales = inQ.filter(isSale);
  const seen = new Map<string, string>();
  for (const s of sales) {
    const key = norm(s.document_no);
    if (seen.has(key)) issues.push({ code: "duplicate_invoice", severity: "error", message: `Invoice ${s.document_no} is recorded twice (records ${seen.get(key)} and ${s.id}).`, record_id: s.id });
    else seen.set(key, s.id);
  }
  const series = new Map<string, number[]>();
  for (const s of sales) {
    const m = /^(.*?)(\d+)$/.exec(s.document_no.trim());
    if (!m) continue;
    series.set(m[1]!, [...(series.get(m[1]!) ?? []), Number(m[2])]);
  }
  for (const [prefix, nums] of series) {
    const sorted = [...new Set(nums)].sort((a, b) => a - b);
    const missing: number[] = [];
    for (let i = 1; i < sorted.length; i++) for (let n = sorted[i - 1]! + 1; n < sorted[i]!; n++) missing.push(n);
    if (missing.length) {
      const shown = missing.slice(0, 5).map((n) => `${prefix}${n}`).join(", ");
      issues.push({
        code: "invoice_gap",
        severity: "warning",
        message: `Invoice numbers are missing from the series: ${shown}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}. Record them, or confirm they were cancelled (keep all copies of cancelled invoices).`,
      });
    }
  }
  for (const m of quarterMonths(q)) {
    if (!sales.some((s) => inRange(s.date, m))) issues.push({ code: "no_sales_month", severity: "warning", message: `No sales are recorded for ${monthLabel(m)}. Confirm there were none, or add them.` });
  }

  // Expenses with tax withheld.
  const warnedTin = new Set<string>();
  for (const e of inQ.filter(isExpense)) {
    if (!e.withholding) continue;
    if (!atcRule(rules, e.withholding.atc, e.date)) {
      issues.push({ code: "unknown_atc", severity: "error", message: `Record ${e.id}: ATC ${e.withholding.atc} is not in TaxGabay's withholding table.`, record_id: e.id });
    }
    if (!e.supplier.tin && !warnedTin.has(norm(e.supplier.name))) {
      warnedTin.add(norm(e.supplier.name));
      issues.push({ code: "missing_payee_tin", severity: "warning", message: `${e.supplier.name}: add the supplier's TIN — it is required on the Form 2307 and in the QAP.`, record_id: e.id });
    }
  }

  // VAT clients: purchases from VAT suppliers go on the summary list of purchases with the supplier's TIN.
  if (opts.vat) {
    const warned = new Set<string>();
    for (const e of inQ.filter(isExpense)) {
      if (!e.supplier_vat_registered || e.supplier.tin || warned.has(norm(e.supplier.name))) continue;
      warned.add(norm(e.supplier.name));
      issues.push({ code: "missing_vat_supplier_tin", severity: "warning", message: `${e.supplier.name}: add the supplier's TIN — input tax is listed by supplier TIN on the summary list of purchases.`, record_id: e.id });
    }
  }

  // Payroll: one record per employee per month, and TINs for the 2316 and alphalist.
  const pay = inQ.filter((r): r is PayrollRecord => r.kind === "payroll");
  const seenPay = new Map<string, string>();
  const warnedEmp = new Set<string>();
  for (const p of pay) {
    const k = `${norm(p.employee.name)}|${p.date.slice(0, 7)}`;
    if (seenPay.has(k)) issues.push({ code: "duplicate_payroll", severity: "error", message: `${p.employee.name} has two payroll records for ${p.date.slice(0, 7)} (records ${seenPay.get(k)} and ${p.id}). Enter one record per employee per month.`, record_id: p.id });
    else seenPay.set(k, p.id);
    if (!p.employee.tin && !warnedEmp.has(norm(p.employee.name))) {
      warnedEmp.add(norm(p.employee.name));
      issues.push({ code: "missing_employee_tin", severity: "warning", message: `${p.employee.name}: add the employee's TIN — it is required on the 2316 and the alphalist.`, record_id: p.id });
    }
  }
  if (pay.length && opts.hasEmployees === false) issues.push({ code: "payroll_without_employees", severity: "warning", message: "Payroll records were entered, but the profile says the business has no employees. Update the profile so the payroll returns are prepared." });

  // 2307s received.
  for (const c of records.filter(is2307)) {
    if (c.period_to < range.start || c.period_from > range.end) continue;
    if (!sales.some((s) => norm(s.customer.name) === norm(c.payor.name))) {
      issues.push({ code: "2307_without_sale", severity: "warning", message: `Form 2307 from ${c.payor.name} has no matching sale to that customer this quarter. Check the customer name or add the sale.`, record_id: c.id });
    }
    const rule = atcRule(rules, c.atc, c.period_to);
    if (!rule) {
      issues.push({ code: "unknown_atc", severity: "warning", message: `Form 2307 from ${c.payor.name}: ATC ${c.atc} is not in TaxGabay's withholding table, so the amount could not be checked.`, record_id: c.id });
    } else {
      const expected = round2(dec(c.income_payment).times(rule.value.rate));
      if (!expected.equals(round2(c.tax_withheld))) {
        issues.push({
          code: "2307_amount_mismatch",
          severity: "warning",
          message: `Form 2307 from ${c.payor.name}: ${peso(c.tax_withheld)} withheld, but ${c.atc} at the table rate gives ${peso(expected)}. Ask the customer to check the certificate.`,
          record_id: c.id,
        });
      }
    }
    if (!c.payor.tin) issues.push({ code: "missing_payor_tin", severity: "warning", message: `Form 2307 from ${c.payor.name}: the customer's TIN is needed for the SAWT.`, record_id: c.id });
  }
  return issues;
}
