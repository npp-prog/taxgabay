import { addDays, daysBetween, minISO, parseISO } from "../dates";
import type { CompromiseValue, InterestValue, SurchargeValue } from "../data/tax-rules";
import { dec, max0, money, pct, peso, round2, type Dec, type MoneyInput } from "../money";
import type { TaxpayerSize } from "../profile";
import { findRule } from "../rules";
import type { CalcResult, ISODate, Step, TaxRule } from "../types";

export interface PenaltyInput {
  form_code?: string;
  due_date: ISODate;
  payment_date: ISODate;
  basic_tax_due: MoneyInput;
  taxpayer_size: Exclude<TaxpayerSize, "not_sure">;
  late_filing: boolean;
  late_payment: boolean;
  willful: boolean;
  include_compromise?: boolean;
}

export interface InterestSegment {
  from: ISODate;
  to: ISODate;
  days: number;
  annual_rate: string;
  amount: string;
  rule_id: string;
}

export interface PenaltyResult {
  days_late: number;
  surcharge: string;
  interest: string;
  interest_segments: InterestSegment[];
  compromise: string;
  total_penalties: string;
  total_amount_due: string;
}

const DAYS_IN_YEAR = 365;

function isMicroSmall(size: PenaltyInput["taxpayer_size"]): boolean {
  return size === "micro" || size === "small";
}

/**
 * Surcharge, interest (per day, split where the rate changes) and compromise penalty
 * for late filing/payment.
 */
export function computePenalty(input: PenaltyInput, rules: readonly TaxRule[]): CalcResult<PenaltyResult> {
  parseISO(input.due_date);
  parseISO(input.payment_date);
  const basic = max0(round2(input.basic_tax_due));
  const daysLate = Math.max(0, daysBetween(input.due_date, input.payment_date));
  const steps: Step[] = [
    { label: "Basic tax due", formula: "As entered", amount: money(basic), legal_basis: null },
  ];
  const rulesUsed: string[] = [];
  const warnings: string[] = [];
  const ms = isMicroSmall(input.taxpayer_size);

  const zeroResult = (): CalcResult<PenaltyResult> => ({
    result: {
      days_late: daysLate,
      surcharge: "0.00",
      interest: "0.00",
      interest_segments: [],
      compromise: "0.00",
      total_penalties: "0.00",
      total_amount_due: money(basic),
    },
    steps,
    rules_used: rulesUsed,
    warnings,
  });

  if (daysLate === 0 || (!input.late_filing && !input.late_payment)) {
    warnings.push("Filed and paid on or before the due date: no penalties.");
    return zeroResult();
  }

  // Surcharge: rule in force on the day after the due date (when the violation occurs).
  const violationDate = addDays(input.due_date, 1);
  const sRule = findRule<SurchargeValue>(rules, "penalty.surcharge", violationDate);
  rulesUsed.push(sRule.id);
  const sRate = input.willful ? sRule.value.willful : ms ? sRule.value.micro_small : sRule.value.standard;
  const surcharge = round2(basic.times(sRate));
  steps.push({
    label: input.willful ? "Surcharge (willful neglect or false return)" : "Surcharge (late filing/payment)",
    formula: `${pct(sRate)} × ${peso(basic)}${ms && !input.willful ? " (micro/small taxpayer rate)" : ""}`,
    amount: money(surcharge),
    legal_basis: sRule.legal_basis,
  });

  // Interest: simple, per day, on unpaid basic tax; segmented across rate changes.
  const segments: InterestSegment[] = [];
  let interest = dec(0);
  if (input.late_payment) {
    let cursor = violationDate; // first day of interest
    while (cursor <= input.payment_date) {
      const iRule = findRule<InterestValue>(rules, "penalty.interest", cursor);
      const segEnd = minISO(iRule.effective_to ?? input.payment_date, input.payment_date);
      const days = daysBetween(cursor, segEnd) + 1;
      const rate = ms ? iRule.value.micro_small : iRule.value.standard;
      const amt = round2(basic.times(rate).times(days).dividedBy(DAYS_IN_YEAR));
      segments.push({ from: cursor, to: segEnd, days, annual_rate: dec(rate).toString(), amount: money(amt), rule_id: iRule.id });
      if (!rulesUsed.includes(iRule.id)) rulesUsed.push(iRule.id);
      interest = interest.plus(amt);
      steps.push({
        label: `Interest ${cursor} to ${segEnd}`,
        formula: `${peso(basic)} × ${pct(rate)} × ${days}/${DAYS_IN_YEAR}`,
        amount: money(amt),
        legal_basis: iRule.legal_basis,
      });
      cursor = addDays(segEnd, 1);
    }
  } else {
    warnings.push("No interest computed because the tax was paid on time (only the return was filed late).");
  }

  // Compromise penalty (optional, in lieu of criminal prosecution).
  let compromise: Dec = dec(0);
  if (input.include_compromise !== false && basic.greaterThan(0)) {
    const cRule = findRule<CompromiseValue>(rules, "penalty.compromise.failure_to_file_pay", violationDate);
    rulesUsed.push(cRule.id);
    const b = cRule.value.brackets.find(
      (x) => basic.greaterThan(x.over) && (x.not_over === null || basic.lessThanOrEqualTo(x.not_over)),
    )!;
    compromise = round2(b.amount);
    steps.push({
      label: "Compromise penalty (suggested)",
      formula: `Schedule: tax due over ${peso(b.over)}${b.not_over ? ` up to ${peso(b.not_over)}` : ""}`,
      amount: money(compromise),
      legal_basis: cRule.legal_basis,
    });
    warnings.push(
      "The compromise penalty is a settlement offered in place of criminal prosecution; it is not imposed by law and may be refused.",
    );
  }

  const totalPen = surcharge.plus(interest).plus(compromise);
  const total = basic.plus(totalPen);
  steps.push({
    label: "Total amount due",
    formula: `${peso(basic)} + ${peso(surcharge)} + ${peso(interest)} + ${peso(compromise)}`,
    amount: money(total),
    legal_basis: null,
  });

  return {
    result: {
      days_late: daysLate,
      surcharge: money(surcharge),
      interest: money(interest),
      interest_segments: segments,
      compromise: money(compromise),
      total_penalties: money(totalPen),
      total_amount_due: money(total),
    },
    steps,
    rules_used: rulesUsed,
    warnings,
  };
}
