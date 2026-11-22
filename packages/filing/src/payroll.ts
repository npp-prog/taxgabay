import { computeAnnualCompensationTax, computeCompensationWithholding, computeEmployerContributions, dec, money, type Dec, type ISODate, type Step, type TaxRule } from "@taxgabay/tax-engine";
import type { ClientRecord, Party, PayrollRecord } from "./types";

/** One employee's pay for one month with the computed contributions and withholding. */
export interface PayLine {
  record: PayrollRecord;
  month: number;
  basic: Dec;
  benefits: Dec;
  de_minimis: Dec;
  sss_ee: Dec;
  sss_er: Dec;
  ph_ee: Dec;
  ph_er: Dec;
  hdmf_ee: Dec;
  hdmf_er: Dec;
  contributions_ee: Dec;
  /** Tax withheld this month (December includes the year-end adjustment). */
  withheld: Dec;
  steps: Step[];
  rules_used: string[];
}

export const employeeKey = (p: Party) => p.name.trim().toLowerCase().replace(/\s+/g, " ");
const z = (v: string | undefined) => dec(v && v.trim() ? v : "0");

export const payrollIn = (records: readonly ClientRecord[], year: number) =>
  records.filter((r): r is PayrollRecord => r.kind === "payroll" && r.date.startsWith(`${year}-`)).sort((a, b) => a.date.localeCompare(b.date));

/** Annual totals for one employee, used for the year-end adjustment, 2316 and the alphalist. */
export interface EmployeeYear {
  employee: Party;
  basic: Dec;
  benefits: Dec;
  de_minimis: Dec;
  contributions_ee: Dec;
  taxable: Dec;
  annual_tax: Dec;
  withheld: Dec;
  minimum_wage_earner: boolean;
  steps: Step[];
  rules_used: string[];
}

function monthlyLine(r: PayrollRecord, rules: readonly TaxRule[]): PayLine {
  const basic = z(r.basic_pay);
  const c = computeEmployerContributions({ monthly_salary: money(basic), date: r.date }, rules);
  const ee = dec(c.result.total_employee);
  let withheld = dec(0);
  let steps: Step[] = c.steps;
  const used = [...c.rules_used];
  if (!r.minimum_wage_earner) {
    const w = computeCompensationWithholding({ period: "monthly", pay_date: r.date, gross_compensation: money(basic), mandatory_contributions: money(ee) }, rules);
    withheld = dec(w.result.withholding_tax);
    steps = [...steps, ...w.steps];
    used.push(...w.rules_used);
  }
  return {
    record: r,
    month: Number(r.date.slice(5, 7)),
    basic,
    benefits: z(r.benefits),
    de_minimis: z(r.de_minimis),
    sss_ee: dec(c.result.sss.employee),
    sss_er: dec(c.result.sss.employer),
    ph_ee: dec(c.result.philhealth.employee),
    ph_er: dec(c.result.philhealth.employer),
    hdmf_ee: dec(c.result.pagibig.employee),
    hdmf_er: dec(c.result.pagibig.employer),
    contributions_ee: ee,
    withheld,
    steps,
    rules_used: used,
  };
}

/**
 * Every payroll line of the year. In December (the employee's last month on the payroll in the
 * year, if that is December) the withholding is replaced by the year-end adjustment: annual tax
 * minus tax withheld in earlier months (negative = refund to the employee).
 */
export function payrollYear(records: readonly ClientRecord[], year: number, rules: readonly TaxRule[]): { lines: PayLine[]; employees: EmployeeYear[] } {
  const lines = payrollIn(records, year).map((r) => monthlyLine(r, rules));
  const byEmp = new Map<string, PayLine[]>();
  for (const l of lines) byEmp.set(employeeKey(l.record.employee), [...(byEmp.get(employeeKey(l.record.employee)) ?? []), l]);
  const employees: EmployeeYear[] = [];
  for (const ls of byEmp.values()) {
    const sumOf = (f: (l: PayLine) => Dec) => ls.reduce((a, l) => a.plus(f(l)), dec(0));
    const mwe = ls.some((l) => l.record.minimum_wage_earner);
    const a = computeAnnualCompensationTax(
      { taxable_year: year, gross_compensation: money(sumOf((l) => l.basic)), mandatory_contributions: money(sumOf((l) => l.contributions_ee)), thirteenth_month_and_other_benefits: money(sumOf((l) => l.benefits)), de_minimis: money(sumOf((l) => l.de_minimis)), tax_withheld: "0" },
      rules,
    );
    const annualTax = mwe ? dec(0) : dec(a.result.annual_tax);
    const dec_ = ls.find((l) => l.month === 12);
    if (dec_) {
      const before = ls.filter((l) => l !== dec_).reduce((acc, l) => acc.plus(l.withheld), dec(0));
      dec_.withheld = annualTax.minus(before);
      dec_.steps = [...dec_.steps, { label: "Year-end adjustment: December withholding", formula: `Annual tax ${money(annualTax)} − withheld January–November ${money(before)}`, amount: money(dec_.withheld), legal_basis: "RR 2-98 Sec. 2.79(B)(5), as amended" }];
    }
    const withheld = ls.reduce((acc, l) => acc.plus(l.withheld), dec(0));
    employees.push({
      employee: ls[ls.length - 1]!.record.employee,
      basic: sumOf((l) => l.basic),
      benefits: sumOf((l) => l.benefits),
      de_minimis: sumOf((l) => l.de_minimis),
      contributions_ee: sumOf((l) => l.contributions_ee),
      taxable: mwe ? dec(0) : dec(a.result.taxable_compensation),
      annual_tax: annualTax,
      withheld,
      minimum_wage_earner: mwe,
      steps: a.steps,
      rules_used: a.rules_used,
    });
  }
  employees.sort((x, y) => x.employee.name.localeCompare(y.employee.name));
  return { lines, employees };
}

export const linesInMonth = (lines: readonly PayLine[], start: ISODate) => lines.filter((l) => l.record.date.slice(0, 7) === start.slice(0, 7));
