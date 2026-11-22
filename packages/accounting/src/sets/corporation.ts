import {
  DEFAULT_PROFILE,
  computeCompensationWithholding,
  computeCorporateIncomeTax,
  computeEmployerContributions,
  computeEwt,
  computePercentageTax,
  dec,
  money,
  peso,
  taxRules,
} from "@taxgabay/tax-engine";
import type { Step } from "@taxgabay/tax-engine";
import type { PracticeSet } from "../practice";

/**
 * Payroll for one month. Contribution shares and withholding come from the tax
 * engine's rule data (all flagged for CPA verification); salaries are given.
 */
const EMPLOYEES = [
  { name: "Jose Dela Cruz (cook)", salary: "25000.00" },
  { name: "Maria Lopez (kitchen helper)", salary: "16000.00" },
] as const;

function payroll(date: string) {
  const rows = EMPLOYEES.map((e) => {
    const c = computeEmployerContributions({ monthly_salary: e.salary, date }, taxRules).result;
    const w = computeCompensationWithholding({ period: "monthly", pay_date: date, gross_compensation: e.salary, mandatory_contributions: c.total_employee }, taxRules);
    return { ...e, c, wt: w.result.withholding_tax, steps: w.steps };
  });
  const total = (f: (r: (typeof rows)[number]) => string) => money(rows.reduce((a, r) => a.plus(f(r)), dec(0)));
  const gross = total((r) => r.salary);
  const sssEe = total((r) => r.c.sss.employee);
  const phEe = total((r) => r.c.philhealth.employee);
  const hdEe = total((r) => r.c.pagibig.employee);
  const wt = total((r) => r.wt);
  return {
    rows,
    gross,
    sssEe,
    phEe,
    hdEe,
    wt,
    net: money(dec(gross).minus(sssEe).minus(phEe).minus(hdEe).minus(wt)),
    sssEr: total((r) => r.c.sss.employer),
    phEr: total((r) => r.c.philhealth.employer),
    hdEr: total((r) => r.c.pagibig.employer),
  };
}

const sept = payroll("2026-09-30");
const oct = payroll("2026-10-31");
const septSss = money(dec(sept.sssEe).plus(sept.sssEr));
const septPh = money(dec(sept.phEe).plus(sept.phEr));
const septHd = money(dec(sept.hdEe).plus(sept.hdEr));
const septContrib = money(dec(septSss).plus(septPh).plus(septHd));
const octEr = money(dec(oct.sssEr).plus(oct.phEr).plus(oct.hdEr));

/** 5% on rent paid to a non-VAT corporate lessor (ATC WC100). */
const septRent = computeEwt({ atc: "WC100", payment_date: "2026-09-01", amount: "30000", vat_inclusive: false }, taxRules);
const rent = computeEwt({ atc: "WC100", payment_date: "2026-10-01", amount: "30000", vat_inclusive: false }, taxRules);
/** Professional fee to an individual lawyer, non-VAT, gross income ₱3M or less (ATC WI010). */
const lawyer = computeEwt({ atc: "WI010", payment_date: "2026-10-22", amount: "20000", vat_inclusive: false }, taxRules);
/** 2% withheld by a top withholding agent client on services (ATC WC160). */
const acme = computeEwt({ atc: "WC160", payment_date: "2026-10-20", amount: "120000", vat_inclusive: false }, taxRules).result;
const octPt = computePercentageTax({ period_end: "2026-10-31", gross_sales_receipts: "217000" }, taxRules).result;

const openingLiabilities = [septSss, septPh, septHd, sept.wt, septRent.result.ewt];
const retainedEarnings = money(openingLiabilities.reduce((a, x) => a.minus(x), dec("550000").minus("40000").minus("400000")));

export const corporationSet: PracticeSet = {
  slug: "small-corporation",
  title: "Bayanihan Kitchen Corp.",
  summary: "A small catering corporation with two employees: payroll and contributions, expanded withholding on rent and fees, percentage tax and the monthly remittances. One month (October 2026).",
  business: {
    name: "Bayanihan Kitchen Corp.",
    owner: "Board of directors (president: Ana Villanueva)",
    form: "corporation",
    description:
      "Bayanihan Kitchen Corp. is a SEC-registered catering company that started in 2025. It is not VAT-registered and pays percentage tax. It has two employees, rents its kitchen from a corporation, and is a withholding agent for compensation and expanded withholding tax.",
    profile: { ...DEFAULT_PROFILE, taxpayer_type: "corporation", vat_status: "non_vat", income_tax_option: "not_applicable", has_employees: true, withholds_expanded: true, taxpayer_size: "small" },
  },
  period: { from: "2026-10-01", to: "2026-10-31", label: "October 2026" },
  level: "intermediate",
  learningGoals: [
    "Record a payroll with employee deductions for SSS, PhilHealth, Pag-IBIG and withholding tax",
    "Record the employer's share of contributions as an expense and a liability",
    "Withhold expanded withholding tax on rent and professional fees, and issue Form 2307",
    "Remit last month's withholding and contributions, clearing the payables",
    "See how the books feed the 1601C, 0619E and 2551Q, and the corporate income tax computation",
  ],
  accounts: [
    { code: "101", name: "Cash on Hand", type: "asset", section: "current_assets" },
    { code: "102", name: "Cash in Bank", type: "asset", section: "current_assets" },
    { code: "110", name: "Accounts Receivable", type: "asset", section: "current_assets" },
    { code: "115", name: "Creditable Withholding Tax", type: "asset", section: "current_assets", description: "Income tax withheld by clients (Form 2307), credited against the corporation's income tax." },
    { code: "150", name: "Kitchen Equipment", type: "asset", section: "noncurrent_assets" },
    { code: "151", name: "Accumulated Depreciation – Kitchen Equipment", type: "asset", section: "noncurrent_assets", contra: true },
    { code: "201", name: "Accounts Payable", type: "liability", section: "current_liabilities" },
    { code: "210", name: "SSS Contributions Payable", type: "liability", section: "current_liabilities" },
    { code: "211", name: "PhilHealth Contributions Payable", type: "liability", section: "current_liabilities" },
    { code: "212", name: "Pag-IBIG Contributions Payable", type: "liability", section: "current_liabilities" },
    { code: "213", name: "Withholding Tax Payable – Compensation", type: "liability", section: "current_liabilities", description: "Tax withheld from employees' pay, remitted with the 1601C." },
    { code: "214", name: "Withholding Tax Payable – Expanded", type: "liability", section: "current_liabilities", description: "Tax withheld from suppliers (rent, fees), remitted with the 0619E or 1601EQ." },
    { code: "215", name: "Percentage Tax Payable", type: "liability", section: "current_liabilities" },
    { code: "301", name: "Share Capital", type: "equity", section: "equity", description: "Amount paid in by stockholders for their shares." },
    { code: "310", name: "Retained Earnings", type: "equity", section: "equity", description: "Accumulated profits kept in the business." },
    { code: "399", name: "Income Summary", type: "equity", section: "temporary" },
    { code: "401", name: "Catering Revenue", type: "revenue", section: "revenue" },
    { code: "501", name: "Food and Ingredients", type: "expense", section: "cost_of_sales", description: "Direct cost of the catering services." },
    { code: "601", name: "Salaries Expense", type: "expense", section: "expenses" },
    { code: "602", name: "Employer Contributions Expense", type: "expense", section: "expenses", description: "Employer's share of SSS, PhilHealth and Pag-IBIG." },
    { code: "603", name: "Rent Expense", type: "expense", section: "expenses" },
    { code: "604", name: "Professional Fees", type: "expense", section: "expenses" },
    { code: "605", name: "Utilities Expense", type: "expense", section: "expenses" },
    { code: "606", name: "Taxes and Licenses", type: "expense", section: "expenses" },
    { code: "607", name: "Depreciation Expense", type: "expense", section: "expenses" },
  ],
  opening: {
    date: "2026-10-01",
    memo: "Opening balances, including September's withholding and contributions still to be remitted",
    lines: [
      { account: "101", debit: "10000.00" },
      { account: "102", debit: "300000.00" },
      { account: "150", debit: "240000.00" },
      { account: "151", credit: "40000.00" },
      { account: "210", credit: septSss },
      { account: "211", credit: septPh },
      { account: "212", credit: septHd },
      { account: "213", credit: sept.wt },
      { account: "214", credit: septRent.result.ewt },
      { account: "301", credit: "400000.00" },
      { account: "310", credit: retainedEarnings },
    ],
  },
  transactions: [
    {
      id: "t01", date: "2026-10-01", book: "CDB",
      narrative: `Paid October rent of ₱30,000 to Kalye Realty Corp. (not VAT-registered), withholding ${peso(rent.result.ewt)} expanded withholding tax. The bank transfer was ${peso(rent.result.net_payment)}.`,
      document: { type: "cash_voucher", number: "CV-1001", party: "Kalye Realty Corp.", details: `October rent ₱30,000.00 less EWT ${peso(rent.result.ewt)} (ATC WC100)` },
      answer: [{ account: "603", debit: "30000.00" }, { account: "214", credit: rent.result.ewt }, { account: "102", credit: rent.result.net_payment }],
      explanation: "The full rent is the expense. The tax you withhold is not yours: you owe it to the BIR until you remit it, so it is a liability.",
      ownerTip: "Give the lessor a Form 2307 for the tax withheld so they can claim it as a credit.",
    },
    {
      id: "t02", date: "2026-10-02", book: "PJ",
      narrative: "Bought meat, vegetables and rice from Palengke Supply for ₱38,000 on 20-day credit.",
      document: { type: "supplier_invoice", number: "PS-4421", party: "Palengke Supply", details: "Ingredients, ₱38,000.00, terms 20 days" },
      answer: [{ account: "501", debit: "38000.00" }, { account: "201", credit: "38000.00" }],
      explanation: "Ingredients used for catering jobs are the direct cost of the service.",
    },
    {
      id: "t03", date: "2026-10-05", book: "SJ",
      narrative: "Catered Acme Manufacturing Inc.'s company anniversary and billed ₱120,000, payable in 15 days.",
      document: { type: "sales_invoice", number: "SI 0388", party: "Acme Manufacturing Inc.", details: "Catering services, ₱120,000.00" },
      answer: [{ account: "110", debit: "120000.00" }, { account: "401", credit: "120000.00" }],
      explanation: "Revenue is earned when the service is done, even if payment comes later.",
    },
    {
      id: "t04", date: "2026-10-08", book: "CRB",
      narrative: "Collected ₱45,000 cash from small party packages during the first week.",
      document: { type: "sales_invoice", details: "Summary of cash invoices, ₱45,000.00" },
      answer: [{ account: "101", debit: "45000.00" }, { account: "401", credit: "45000.00" }],
      explanation: "Cash sales increase Cash on Hand and revenue.",
    },
    {
      id: "t05", date: "2026-10-09", book: "CDB",
      narrative: `Remitted September's withholding tax on compensation, ${peso(sept.wt)}, with the 1601C.`,
      document: { type: "bank_statement", details: `BIR payment, 1601C September 2026, ${peso(sept.wt)}` },
      answer: [{ account: "213", debit: sept.wt }, { account: "102", credit: sept.wt }],
      explanation: "Remitting clears the liability recorded when the tax was withheld from September's pay.",
    },
    {
      id: "t06", date: "2026-10-12", book: "CDB",
      narrative: `Remitted September's SSS (${peso(septSss)}), PhilHealth (${peso(septPh)}) and Pag-IBIG (${peso(septHd)}) contributions, employee and employer shares, ${peso(septContrib)} in total.`,
      document: { type: "bank_statement", details: `Online payments: SSS ${peso(septSss)}; PhilHealth ${peso(septPh)}; Pag-IBIG ${peso(septHd)}` },
      answer: [{ account: "210", debit: septSss }, { account: "211", debit: septPh }, { account: "212", debit: septHd }, { account: "102", credit: septContrib }],
      explanation: "Each payable is cleared by the amount remitted, which includes both the employees' deductions and the employer's share.",
      ownerTip: "Each agency has its own payment deadline; see the payroll guide.",
    },
    {
      id: "t07", date: "2026-10-15", book: "GJ",
      narrative: "Deposited ₱40,000 of the cash on hand into the bank.",
      document: { type: "deposit_slip", details: "Cash deposit, ₱40,000.00" },
      answer: [{ account: "102", debit: "40000.00" }, { account: "101", credit: "40000.00" }],
      explanation: "A transfer between cash accounts.",
    },
    {
      id: "t08", date: "2026-10-20", book: "CRB",
      narrative: `Acme Manufacturing Inc., a top withholding agent, paid SI 0388 after withholding ${peso(acme.ewt)}. The bank received ${peso(acme.net_payment)} and Acme gave a Form 2307.`,
      document: { type: "form_2307", party: "Acme Manufacturing Inc.", details: `Income payment ₱120,000.00; tax withheld ${peso(acme.ewt)} (ATC WC160)` },
      answer: [{ account: "102", debit: acme.net_payment }, { account: "115", debit: acme.ewt }, { account: "110", credit: "120000.00" }],
      explanation: "The whole receivable is cleared. The tax withheld by the client is a credit against the corporation's income tax.",
    },
    {
      id: "t09", date: "2026-10-22", book: "CDB",
      narrative: `Paid Atty. Ramon Cruz (an individual, not VAT-registered, gross income under ₱3M) ₱20,000 for amending the articles of incorporation, withholding ${peso(lawyer.result.ewt)}.`,
      document: { type: "cash_voucher", number: "CV-1002", party: "Atty. Ramon Cruz", details: `Professional fee ₱20,000.00 less EWT ${peso(lawyer.result.ewt)} (ATC WI010)` },
      answer: [{ account: "604", debit: "20000.00" }, { account: "214", credit: lawyer.result.ewt }, { account: "102", credit: lawyer.result.net_payment }],
      explanation: "Professional fees are subject to expanded withholding. The rate depends on whether the payee is an individual or a corporation and on their income or VAT status.",
      ownerTip: "Ask for the lawyer's sworn declaration of gross income to know which rate applies.",
    },
    {
      id: "t10", date: "2026-10-22", book: "CDB",
      narrative: "Paid Palengke Supply ₱38,000 for invoice PS-4421.",
      document: { type: "official_receipt", party: "Palengke Supply", details: "Payment of PS-4421, ₱38,000.00" },
      answer: [{ account: "201", debit: "38000.00" }, { account: "102", credit: "38000.00" }],
      explanation: "Paying the supplier clears the payable.",
    },
    {
      id: "t11", date: "2026-10-27", book: "CDB",
      narrative: "Paid the October electricity, water and LPG bills of ₱8,500 from the bank account.",
      document: { type: "bank_statement", details: "Bills payment, ₱8,500.00" },
      answer: [{ account: "605", debit: "8500.00" }, { account: "102", credit: "8500.00" }],
      explanation: "Utilities used in October.",
    },
    {
      id: "t12", date: "2026-10-31", book: "CDB",
      narrative: `Paid the October payroll per the payroll register: gross salaries ${peso(oct.gross)}; deducted SSS ${peso(oct.sssEe)}, PhilHealth ${peso(oct.phEe)}, Pag-IBIG ${peso(oct.hdEe)} and withholding tax ${peso(oct.wt)}. Net pay of ${peso(oct.net)} was transferred to the employees.`,
      document: {
        type: "payroll_register",
        details: oct.rows.map((r) => `${r.name}: gross ${peso(r.salary)}; SSS ${peso(r.c.sss.employee)}; PhilHealth ${peso(r.c.philhealth.employee)}; Pag-IBIG ${peso(r.c.pagibig.employee)}; tax ${peso(r.wt)}`).join(" | "),
      },
      answer: [
        { account: "601", debit: oct.gross },
        { account: "210", credit: oct.sssEe },
        { account: "211", credit: oct.phEe },
        { account: "212", credit: oct.hdEe },
        { account: "213", credit: oct.wt },
        { account: "102", credit: oct.net },
      ],
      explanation: "The expense is the gross salary. Amounts deducted from the employees are owed to SSS, PhilHealth, Pag-IBIG and the BIR until remitted.",
    },
    {
      id: "t13", date: "2026-10-31", book: "GJ",
      narrative: `Record the employer's share of October contributions: SSS ${peso(oct.sssEr)}, PhilHealth ${peso(oct.phEr)}, Pag-IBIG ${peso(oct.hdEr)}.`,
      document: { type: "payroll_register", details: `Employer share: SSS ${peso(oct.sssEr)}; PhilHealth ${peso(oct.phEr)}; Pag-IBIG ${peso(oct.hdEr)}` },
      answer: [{ account: "602", debit: octEr }, { account: "210", credit: oct.sssEr }, { account: "211", credit: oct.phEr }, { account: "212", credit: oct.hdEr }],
      explanation: "The employer's share is an extra cost on top of salaries, owed to the agencies until remitted next month.",
    },
    {
      id: "t14", date: "2026-10-31", book: "CRB",
      narrative: "Collected ₱52,000 cash from party packages during the rest of the month.",
      document: { type: "sales_invoice", details: "Summary of cash invoices, ₱52,000.00" },
      answer: [{ account: "101", debit: "52000.00" }, { account: "401", credit: "52000.00" }],
      explanation: "Cash sales.",
    },
  ],
  adjustments: [
    {
      id: "a01", date: "2026-10-31", book: "GJ",
      narrative: "Record depreciation for October on the kitchen equipment (₱240,000 cost, 5-year life, straight-line, no salvage value).",
      answer: [{ account: "607", debit: "4000.00" }, { account: "151", credit: "4000.00" }],
      explanation: "₱240,000 ÷ 60 months = ₱4,000 a month.",
    },
    {
      id: "a02", date: "2026-10-31", book: "GJ",
      narrative: `Accrue percentage tax on October's gross receipts of ₱217,000: ${peso(octPt.tax_due)}.`,
      answer: [{ account: "606", debit: octPt.tax_due }, { account: "215", credit: octPt.tax_due }],
      explanation: "Percentage tax is an expense of the month the receipts were earned, paid later with the quarterly 2551Q.",
    },
  ],
  incomeSummaryAccount: "399",
  earningsAccount: "310",
  books: ["CRB", "CDB", "SJ", "PJ", "GJ"],
  returns: (ctx) => {
    const revenue = dec(ctx.net(["401"])).negated();
    const cos = dec(ctx.net(["501"]));
    const opex = dec(ctx.net(["601", "602", "603", "604", "605", "606", "607"]));
    const assets = dec(ctx.net(["101", "102", "110", "115", "150", "151"]));
    const pt = computePercentageTax({ period_end: "2026-10-31", gross_sales_receipts: money(revenue) }, taxRules);
    const cit = computeCorporateIncomeTax(
      { taxable_year_end: "2026-12-31", year_commenced: 2025, gross_sales: money(revenue), cost_of_sales: money(cos), deductions: money(opex), total_assets_excl_land: money(assets) },
      taxRules,
    );
    const wtSteps: Step[] = oct.rows.map((r) => ({
      label: `Withholding tax — ${r.name}`,
      formula: `Monthly table on ${peso(r.salary)} less ${peso(r.c.total_employee)} contributions`,
      amount: r.wt,
      legal_basis: r.steps.at(-1)?.legal_basis ?? null,
    }));
    wtSteps.push({ label: "Total tax withheld on compensation", formula: wtSteps.map((s) => peso(s.amount)).join(" + "), amount: oct.wt, legal_basis: null });
    const ewtTotal = money(dec(rent.result.ewt).plus(lawyer.result.ewt));
    return [
      {
        form: "1601C",
        title: "Monthly remittance of tax withheld on compensation",
        period: "October 2026",
        steps: wtSteps,
        summary: `Remit ${peso(oct.wt)} withheld from October salaries; it ties to Withholding Tax Payable – Compensation.`,
        notes: ["Employees whose taxable pay falls in the zero bracket have no tax withheld but are still reported.", "At year end, give each employee a Form 2316."],
      },
      {
        form: "0619E",
        title: "Monthly remittance of expanded withholding tax",
        period: "October 2026 (first month of Q4)",
        steps: [
          ...rent.steps.filter((s) => s.label.startsWith("Expanded")).map((s) => ({ ...s, label: `${s.label} — rent` })),
          ...lawyer.steps.filter((s) => s.label.startsWith("Expanded")).map((s) => ({ ...s, label: `${s.label} — professional fee` })),
          { label: "Total expanded withholding for October", formula: `${peso(rent.result.ewt)} + ${peso(lawyer.result.ewt)}`, amount: ewtTotal, legal_basis: null },
        ],
        summary: `Remit ${peso(ewtTotal)} with the 0619E. The quarter's total goes on the 1601EQ with the list of payees.`,
        notes: ["Issue Form 2307 to Kalye Realty Corp. and Atty. Cruz.", "September's EWT on rent (in the opening balance) belongs to the Q3 1601EQ."],
      },
      {
        form: "2551Q",
        title: "Quarterly percentage tax return (October's share)",
        period: "Q4 2026, October–December",
        steps: pt.steps,
        summary: `October's gross receipts add ${peso(pt.result.tax_due)} to the Q4 2551Q; it ties to Percentage Tax Payable.`,
        notes: ["The return covers the whole quarter: add November and December receipts."],
      },
      {
        form: "1702Q",
        title: "Corporate income tax (illustration on October's figures)",
        period: "Illustration only — the 1702Q is cumulative for the quarters of the year",
        steps: cit.steps,
        summary: `If October were the whole period, income tax due would be ${peso(cit.result.tax_due)} before the ${peso(acme.ewt)} creditable withholding tax from Acme.`,
        notes: [
          "No income tax is accrued in this set; a real quarterly return uses cumulative year-to-date figures.",
          "The rate depends on taxable income and total assets; the minimum corporate income tax may apply from the fourth year of operations.",
          ...cit.warnings,
        ],
      },
    ];
  },
  needs_verification: true,
};
