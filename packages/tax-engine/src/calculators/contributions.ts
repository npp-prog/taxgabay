import type { PagIbigValue, PhilHealthValue, SssValue } from "../data/employer-rules";
import { dec, max0, money, pct, peso, round2, type Dec, type MoneyInput } from "../money";
import { findRule } from "../rules";
import type { CalcResult, ISODate, Step, TaxRule } from "../types";

export interface ContributionsInput {
  monthly_salary: MoneyInput;
  /** Payroll month; picks the rates in force. */
  date: ISODate;
}

interface Share {
  base: string;
  employee: string;
  employer: string;
}

export interface ContributionsResult {
  sss: Share;
  philhealth: Share;
  pagibig: Share;
  total_employee: string;
  total_employer: string;
}

const clamp = (v: Dec, lo: MoneyInput, hi: MoneyInput) => (v.lessThan(lo) ? dec(lo) : v.greaterThan(hi) ? dec(hi) : v);

/** Monthly SSS, PhilHealth and Pag-IBIG shares for one employee. */
export function computeEmployerContributions(input: ContributionsInput, rules: readonly TaxRule[]): CalcResult<ContributionsResult> {
  const salary = max0(round2(input.monthly_salary));
  const sssR = findRule<SssValue>(rules, "employer.sss", input.date);
  const phR = findRule<PhilHealthValue>(rules, "employer.philhealth", input.date);
  const hdR = findRule<PagIbigValue>(rules, "employer.pagibig", input.date);
  const steps: Step[] = [{ label: "Monthly salary", formula: "As entered", amount: money(salary), legal_basis: null }];

  // SSS: salary rounded to the nearest monthly salary credit step, within the floor and ceiling.
  const s = sssR.value;
  const msc = clamp(salary.dividedBy(s.msc_step).toDecimalPlaces(0, 4).times(s.msc_step), s.msc_floor, s.msc_ceiling);
  const sssEe = round2(msc.times(s.employee_rate));
  const sssEr = round2(msc.times(s.employer_rate));
  steps.push(
    { label: "SSS monthly salary credit", formula: `${peso(salary)} rounded to the nearest ${peso(s.msc_step)}, between ${peso(s.msc_floor)} and ${peso(s.msc_ceiling)}`, amount: money(msc), legal_basis: sssR.legal_basis },
    { label: "SSS — employee share", formula: `${pct(s.employee_rate)} × ${peso(msc)}`, amount: money(sssEe), legal_basis: sssR.legal_basis },
    { label: "SSS — employer share", formula: `${pct(s.employer_rate)} × ${peso(msc)}`, amount: money(sssEr), legal_basis: sssR.legal_basis },
  );

  // PhilHealth: premium on salary within floor and ceiling, shared.
  const p = phR.value;
  const phBase = clamp(salary, p.income_floor, p.income_ceiling);
  const premium = round2(phBase.times(p.rate));
  const phEe = round2(premium.times(p.employee_share));
  const phEr = premium.minus(phEe);
  steps.push(
    { label: "PhilHealth premium", formula: `${pct(p.rate)} × ${peso(phBase)} (salary between ${peso(p.income_floor)} and ${peso(p.income_ceiling)})`, amount: money(premium), legal_basis: phR.legal_basis },
    { label: "PhilHealth — employee share", formula: `${pct(p.employee_share)} of ${peso(premium)}`, amount: money(phEe), legal_basis: phR.legal_basis },
    { label: "PhilHealth — employer share", formula: `${peso(premium)} − ${peso(phEe)}`, amount: money(phEr), legal_basis: phR.legal_basis },
  );

  // Pag-IBIG: rates on salary up to the maximum compensation.
  const h = hdR.value;
  const hdBase = salary.greaterThan(h.max_compensation) ? dec(h.max_compensation) : salary;
  const eeRate = salary.lessThanOrEqualTo(h.low_income_limit) ? h.employee_rate_low : h.employee_rate;
  const hdEe = round2(hdBase.times(eeRate));
  const hdEr = round2(hdBase.times(h.employer_rate));
  steps.push(
    { label: "Pag-IBIG — employee share", formula: `${pct(eeRate)} × ${peso(hdBase)} (up to ${peso(h.max_compensation)})`, amount: money(hdEe), legal_basis: hdR.legal_basis },
    { label: "Pag-IBIG — employer share", formula: `${pct(h.employer_rate)} × ${peso(hdBase)}`, amount: money(hdEr), legal_basis: hdR.legal_basis },
  );

  const totalEe = sssEe.plus(phEe).plus(hdEe);
  const totalEr = sssEr.plus(phEr).plus(hdEr);
  steps.push(
    { label: "Total deducted from the employee", formula: `${peso(sssEe)} + ${peso(phEe)} + ${peso(hdEe)}`, amount: money(totalEe), legal_basis: null },
    { label: "Total employer share", formula: `${peso(sssEr)} + ${peso(phEr)} + ${peso(hdEr)}`, amount: money(totalEr), legal_basis: null },
  );

  return {
    result: {
      sss: { base: money(msc), employee: money(sssEe), employer: money(sssEr) },
      philhealth: { base: money(phBase), employee: money(phEe), employer: money(phEr) },
      pagibig: { base: money(hdBase), employee: money(hdEe), employer: money(hdEr) },
      total_employee: money(totalEe),
      total_employer: money(totalEr),
    },
    steps,
    rules_used: [sssR.id, phR.id, hdR.id],
    warnings: ["SSS Employees' Compensation (EC) and provident fund (WISP) portions are not included. Rates are pending CPA verification."],
  };
}
