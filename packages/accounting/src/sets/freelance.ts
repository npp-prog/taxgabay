import { DEFAULT_PROFILE, computeEwt, computeIndividualIncomeTax, dec, money, peso, taxRules } from "@taxgabay/tax-engine";
import type { PracticeSet } from "../practice";

/** 5% expanded withholding (ATC WI010) on a professional fee, from the tax engine's rule data. */
function ewt(fee: string, date: string) {
  const r = computeEwt({ atc: "WI010", payment_date: date, amount: fee, vat_inclusive: false }, taxRules).result;
  return { withheld: r.ewt, net: r.net_payment };
}

const kape1 = ewt("30000", "2026-01-20");
const bayani = ewt("80000", "2026-02-28");

export const freelanceSet: PracticeSet = {
  slug: "freelance-designer",
  title: "Ligaya Reyes Design Studio",
  summary: "A freelance graphic designer: non-VAT, on the 8% option, with corporate clients who withhold 5% tax. One quarter (January–March 2026).",
  business: {
    name: "Ligaya Reyes Design Studio",
    owner: "Ligaya Reyes",
    form: "sole_proprietorship",
    description:
      "Ligaya registered as a self-employed professional (graphic design) with the BIR in 2025. She is not VAT-registered and chose the 8% income tax option. Her corporate clients withhold 5% expanded withholding tax and give her BIR Form 2307.",
    profile: { ...DEFAULT_PROFILE, taxpayer_type: "self_employed", vat_status: "non_vat", income_tax_option: "eight_percent", has_employees: false, withholds_expanded: false, taxpayer_size: "micro" },
  },
  period: { from: "2026-01-01", to: "2026-03-31", label: "First quarter 2026" },
  level: "beginner",
  learningGoals: [
    "Record service income billed on account and collected later",
    "Record collections net of 5% expanded withholding and keep the BIR Form 2307 as a tax credit",
    "Separate the owner's personal withdrawals from business expenses",
    "Record depreciation and bank charges at the end of the quarter",
    "See how the books feed the quarterly income tax return (1701Q) under the 8% option",
  ],
  accounts: [
    { code: "101", name: "Cash on Hand", type: "asset", section: "current_assets", description: "Cash kept at the studio before it is deposited." },
    { code: "102", name: "Cash in Bank", type: "asset", section: "current_assets", description: "The business bank account." },
    { code: "110", name: "Accounts Receivable", type: "asset", section: "current_assets", description: "Amounts clients owe for invoices not yet paid." },
    { code: "115", name: "Creditable Withholding Tax", type: "asset", section: "current_assets", description: "Tax clients withheld and reported on Form 2307; deducted from your income tax." },
    { code: "150", name: "Computer Equipment", type: "asset", section: "noncurrent_assets" },
    { code: "151", name: "Accumulated Depreciation – Computer Equipment", type: "asset", section: "noncurrent_assets", contra: true },
    { code: "201", name: "Accounts Payable", type: "liability", section: "current_liabilities", description: "Amounts you owe suppliers." },
    { code: "301", name: "Ligaya Reyes, Capital", type: "equity", section: "equity" },
    { code: "302", name: "Ligaya Reyes, Drawing", type: "equity", section: "equity", contra: true, description: "Money the owner takes for personal use. Not an expense." },
    { code: "399", name: "Income Summary", type: "equity", section: "temporary" },
    { code: "401", name: "Professional Fees", type: "revenue", section: "revenue" },
    { code: "501", name: "Rent Expense", type: "expense", section: "expenses" },
    { code: "502", name: "Utilities Expense", type: "expense", section: "expenses" },
    { code: "503", name: "Internet and Communication", type: "expense", section: "expenses" },
    { code: "504", name: "Software Subscriptions", type: "expense", section: "expenses" },
    { code: "505", name: "Office Supplies Expense", type: "expense", section: "expenses" },
    { code: "506", name: "Taxes and Licenses", type: "expense", section: "expenses" },
    { code: "507", name: "Depreciation Expense", type: "expense", section: "expenses" },
    { code: "508", name: "Bank Charges", type: "expense", section: "expenses" },
  ],
  opening: {
    date: "2026-01-01",
    memo: "Opening balances: cash in bank and laptop invested by the owner",
    lines: [
      { account: "102", debit: "80000.00" },
      { account: "150", debit: "75000.00" },
      { account: "301", credit: "155000.00" },
    ],
  },
  transactions: [
    {
      id: "t01", date: "2026-01-02", book: "CDB",
      narrative: "Paid January rent for the studio space, ₱8,000, by bank transfer.",
      document: { type: "official_receipt", number: "OR 1123", party: "Santos Building", details: "Rent for January 2026, ₱8,000.00" },
      answer: [{ account: "501", debit: "8000.00" }, { account: "102", credit: "8000.00" }],
      explanation: "Rent for the current month is an expense. Paying by bank transfer reduces Cash in Bank.",
    },
    {
      id: "t02", date: "2026-01-05", book: "CDB",
      narrative: "Paid the mayor's permit and barangay clearance, ₱3,500, from the bank account.",
      document: { type: "official_receipt", number: "LGU OR 77812", party: "City Treasurer", details: "Business permit and barangay clearance, ₱3,500.00" },
      answer: [{ account: "506", debit: "3500.00" }, { account: "102", credit: "3500.00" }],
      explanation: "Permit and license fees paid to the LGU are recorded as Taxes and Licenses.",
      ownerTip: "Keep the LGU official receipts with your books; they support the expense.",
    },
    {
      id: "t03", date: "2026-01-08", book: "SJ",
      narrative: "Billed Kape Co., Inc. ₱30,000 for a logo design, payable in 30 days.",
      document: { type: "sales_invoice", number: "SI 0001", party: "Kape Co., Inc.", details: "Logo design, ₱30,000.00, terms 30 days" },
      answer: [{ account: "110", debit: "30000.00" }, { account: "401", credit: "30000.00" }],
      explanation: "Income is earned when the work is billed, even before payment. The client now owes you, so Accounts Receivable goes up.",
      ownerTip: "Under the Ease of Paying Taxes Act, the sales invoice is your main document for each sale of a service.",
    },
    {
      id: "t04", date: "2026-01-12", book: "PJ",
      narrative: "Bought a drawing tablet from Digital Hub for ₱12,000 on 30-day credit.",
      document: { type: "supplier_invoice", number: "DH-4471", party: "Digital Hub", details: "Drawing tablet, ₱12,000.00, terms 30 days" },
      answer: [{ account: "150", debit: "12000.00" }, { account: "201", credit: "12000.00" }],
      explanation: "A tablet used for several years is equipment (an asset), not an expense. Buying on credit increases Accounts Payable.",
    },
    {
      id: "t05", date: "2026-01-15", book: "CDB",
      narrative: "Paid the design software subscription for January, ₱3,200, charged to the bank account.",
      document: { type: "bank_statement", details: "Card payment: design software subscription, ₱3,200.00" },
      answer: [{ account: "504", debit: "3200.00" }, { account: "102", credit: "3200.00" }],
      explanation: "A monthly subscription is an expense of the month it covers.",
    },
    {
      id: "t06", date: "2026-01-20", book: "CRB",
      narrative: `Kape Co., Inc. paid invoice SI 0001 after withholding 5% expanded withholding tax. Ligaya received ${peso(kape1.net)} in the bank and a BIR Form 2307 for ${peso(kape1.withheld)}.`,
      document: { type: "form_2307", party: "Kape Co., Inc.", details: `Income payment ₱30,000.00; tax withheld ${peso(kape1.withheld)} (ATC WI010)` },
      answer: [{ account: "102", debit: kape1.net }, { account: "115", debit: kape1.withheld }, { account: "110", credit: "30000.00" }],
      explanation: "The whole ₱30,000 receivable is settled: part in cash, part as tax withheld for you. The withheld amount is an asset (Creditable Withholding Tax) because it reduces your income tax later.",
      ownerTip: "Always ask clients for Form 2307. Without it you cannot claim the tax they withheld.",
    },
    {
      id: "t07", date: "2026-01-25", book: "CRB",
      narrative: "Received ₱6,000 in cash from an individual client for a social media design package. No tax was withheld.",
      document: { type: "sales_invoice", number: "SI 0002", party: "Maria Dizon", details: "Social media package, ₱6,000.00, paid in cash" },
      answer: [{ account: "101", debit: "6000.00" }, { account: "401", credit: "6000.00" }],
      explanation: "A cash sale increases Cash on Hand and income at the same time.",
    },
    {
      id: "t08", date: "2026-01-31", book: "CDB",
      narrative: "Paid January bills from the bank account: electricity ₱2,400 and internet ₱1,800.",
      document: { type: "bank_statement", details: "Bills payment: electricity ₱2,400.00; internet ₱1,800.00" },
      answer: [{ account: "502", debit: "2400.00" }, { account: "503", debit: "1800.00" }, { account: "102", credit: "4200.00" }],
      explanation: "Two expenses paid in one transaction: debit each expense, credit the bank for the total.",
    },
    {
      id: "t09", date: "2026-02-03", book: "GJ",
      narrative: "Deposited the ₱6,000 cash on hand into the bank account.",
      document: { type: "deposit_slip", details: "Cash deposit, ₱6,000.00" },
      answer: [{ account: "102", debit: "6000.00" }, { account: "101", credit: "6000.00" }],
      explanation: "Moving cash into the bank changes where the money is, not how much the business has. No income or expense.",
    },
    {
      id: "t10", date: "2026-02-06", book: "CDB",
      narrative: "Paid Digital Hub the ₱12,000 owed for the drawing tablet.",
      document: { type: "official_receipt", party: "Digital Hub", details: "Payment of invoice DH-4471, ₱12,000.00" },
      answer: [{ account: "201", debit: "12000.00" }, { account: "102", credit: "12000.00" }],
      explanation: "Paying a supplier reduces what you owe (Accounts Payable) and your bank balance.",
    },
    {
      id: "t11", date: "2026-02-14", book: "SJ",
      narrative: "Billed Bayani Corp. ₱80,000 for a website design project.",
      document: { type: "sales_invoice", number: "SI 0003", party: "Bayani Corp.", details: "Website design, ₱80,000.00, terms 15 days" },
      answer: [{ account: "110", debit: "80000.00" }, { account: "401", credit: "80000.00" }],
      explanation: "Billing on account: Accounts Receivable and Professional Fees both increase.",
    },
    {
      id: "t12", date: "2026-02-28", book: "CRB",
      narrative: `Bayani Corp. paid SI 0003 net of 5% withholding: ${peso(bayani.net)} deposited and a Form 2307 for ${peso(bayani.withheld)}.`,
      document: { type: "form_2307", party: "Bayani Corp.", details: `Income payment ₱80,000.00; tax withheld ${peso(bayani.withheld)} (ATC WI010)` },
      answer: [{ account: "102", debit: bayani.net }, { account: "115", debit: bayani.withheld }, { account: "110", credit: "80000.00" }],
      explanation: "Same pattern as Kape Co.: clear the full receivable, split between cash received and tax withheld.",
    },
    {
      id: "t13", date: "2026-03-02", book: "CDB",
      narrative: "Ligaya transferred ₱15,000 from the business account to her personal account for family expenses.",
      document: { type: "bank_statement", details: "Transfer to personal account, ₱15,000.00" },
      answer: [{ account: "302", debit: "15000.00" }, { account: "102", credit: "15000.00" }],
      explanation: "Personal use of business money is a withdrawal (Drawing), not an expense. It reduces the owner's equity, not the business's income.",
      ownerTip: "Never record personal spending as a business expense; it overstates deductions and can be disallowed in an audit.",
    },
    {
      id: "t14", date: "2026-03-10", book: "CDB",
      narrative: "Bought printer ink and paper for ₱1,500, paid from the bank account.",
      document: { type: "official_receipt", party: "National Book Store", details: "Ink and paper, ₱1,500.00" },
      answer: [{ account: "505", debit: "1500.00" }, { account: "102", credit: "1500.00" }],
      explanation: "Small supplies used up quickly are expensed when bought.",
    },
    {
      id: "t15", date: "2026-03-18", book: "SJ",
      narrative: "Billed Kape Co., Inc. ₱20,000 for a menu design, payable in 30 days.",
      document: { type: "sales_invoice", number: "SI 0004", party: "Kape Co., Inc.", details: "Menu design, ₱20,000.00, terms 30 days" },
      answer: [{ account: "110", debit: "20000.00" }, { account: "401", credit: "20000.00" }],
      explanation: "Another sale on account. It is still unpaid at the end of the quarter.",
    },
    {
      id: "t16", date: "2026-03-31", book: "CDB",
      narrative: "Paid rent for February and March, ₱16,000, by bank transfer.",
      document: { type: "official_receipt", number: "OR 1167", party: "Santos Building", details: "Rent for February and March 2026, ₱16,000.00" },
      answer: [{ account: "501", debit: "16000.00" }, { account: "102", credit: "16000.00" }],
      explanation: "Both months are within the quarter, so the whole amount is rent expense.",
    },
    {
      id: "t17", date: "2026-03-31", book: "CDB",
      narrative: "Paid February and March bills: electricity ₱4,600 and internet ₱3,600.",
      document: { type: "bank_statement", details: "Bills payment: electricity ₱4,600.00; internet ₱3,600.00" },
      answer: [{ account: "502", debit: "4600.00" }, { account: "503", debit: "3600.00" }, { account: "102", credit: "8200.00" }],
      explanation: "Utilities for months already used are expenses of the quarter.",
    },
  ],
  adjustments: [
    {
      id: "a01", date: "2026-03-31", book: "GJ",
      narrative: "Record depreciation for the quarter: the laptop (₱75,000, 5-year life) for 3 months and the tablet (₱12,000, 5-year life) for February and March. Use straight-line, no salvage value.",
      answer: [{ account: "507", debit: "4150.00" }, { account: "151", credit: "4150.00" }],
      explanation: "Laptop: ₱75,000 ÷ 60 months × 3 = ₱3,750. Tablet: ₱12,000 ÷ 60 × 2 = ₱400. Total ₱4,150. Depreciation spreads the cost of equipment over the years it is used.",
    },
    {
      id: "a02", date: "2026-03-31", book: "GJ",
      narrative: "The March bank statement shows ₱150 in service charges not yet recorded.",
      document: { type: "bank_statement", details: "Service charges, ₱150.00" },
      answer: [{ account: "508", debit: "150.00" }, { account: "102", credit: "150.00" }],
      explanation: "Bank charges appear only on the statement, so they are recorded at the end of the period when you reconcile the bank.",
    },
  ],
  incomeSummaryAccount: "399",
  earningsAccount: "301",
  books: ["CRB", "CDB", "SJ", "PJ", "GJ"],
  returns: (ctx) => {
    const gross = dec(ctx.net(["401"], "2026-01-01", "2026-03-31")).negated();
    const cwt = dec(ctx.net(["115"], "2026-01-01", "2026-03-31"));
    const r = computeIndividualIncomeTax({ taxable_year: 2026, gross_sales_receipts: money(gross), vat_registered: false }, taxRules);
    const eight = r.result.options.find((o) => o.key === "eight_percent")!;
    const due = dec(eight.income_tax).minus(cwt);
    return [
      {
        form: "1701Q",
        title: "Quarterly income tax return (8% option)",
        period: "Q1 2026 (due 15 May 2026)",
        steps: [
          ...eight.steps,
          { label: "Less: creditable withholding tax (Forms 2307)", formula: "Total of Account 115 for the quarter", amount: money(cwt), legal_basis: "NIRC Sec. 58; RR 2-98" },
          { label: due.isNegative() ? "Excess credits carried to the next quarter" : "Income tax payable", formula: `${peso(eight.income_tax)} − ${peso(cwt)}`, amount: money(due.abs()), legal_basis: null },
        ],
        summary: due.isNegative()
          ? `No tax to pay this quarter: gross receipts of ${peso(gross)} are still below the ₱250,000 that the 8% option exempts for the year, so the ${peso(cwt)} withheld by clients carries over to the next quarter.`
          : `Pay ${peso(due)} with the 1701Q.`,
        notes: [
          "Under the 8% option there is no percentage tax (2551Q) to file.",
          "The 1701Q is cumulative: next quarter you add April–June receipts to these and deduct the ₱250,000 once for the year.",
          "This uses billed fees (accrual). If you report on collections, use the receipts actually collected instead — confirm with your CPA.",
        ],
      },
    ];
  },
  needs_verification: true,
};
