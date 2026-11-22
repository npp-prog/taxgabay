import { DEFAULT_PROFILE, computeEwt, computeVat, dec, findRule, money, peso, splitVat, taxRules } from "@taxgabay/tax-engine";
import type { PracticeSet } from "../practice";

/** VAT on a VAT-exclusive amount, using the rate in force from the tax engine's rule data. */
function vat(base: string, date: string) {
  const rate = findRule<{ rate: string }>(taxRules, "vat.rate", date).value.rate;
  const s = splitVat(base, rate, false);
  return { base: money(s.net), vat: money(s.vat), gross: money(s.gross) };
}

const ink1 = vat("40000", "2026-07-03");
const lakbay = vat("60000", "2026-07-08");
const walkin1 = vat("25000", "2026-07-12");
const laminator = vat("24000", "2026-08-14");
const sunrise = vat("18000", "2026-08-20");
const walkin2 = vat("32000", "2026-09-04");
const meralco = vat("6000", "2026-09-10");
const ink2 = vat("22000", "2026-09-20");
/** 2% expanded withholding by a top withholding agent on services (ATC WI160), on the amount net of VAT. */
const lakbayEwt = computeEwt({ atc: "WI160", payment_date: "2026-08-05", amount: lakbay.gross, vat_inclusive: true }, taxRules).result;

const salesBases = [lakbay, walkin1, sunrise, walkin2].map((x) => x.base);
const purchaseBases = [ink1, laminator, meralco, ink2].map((x) => x.base);
const sum = (xs: string[]) => money(xs.reduce((a, b) => a.plus(b), dec(0)));

export const vatBusinessSet: PracticeSet = {
  slug: "vat-printing-shop",
  title: "PrintHub Trading",
  summary: "A VAT-registered printing shop: output and input VAT, a top withholding agent client, and the quarterly VAT return. One quarter (July–September 2026).",
  business: {
    name: "PrintHub Trading",
    owner: "Carlo Mendoza",
    form: "sole_proprietorship",
    description:
      "Carlo's printing shop is VAT-registered. He adds VAT to his invoices, claims input VAT on his VAT-registered suppliers' invoices, and uses graduated income tax rates with itemized deductions. One corporate client is a top withholding agent and withholds 2% on his services.",
    profile: { ...DEFAULT_PROFILE, taxpayer_type: "sole_proprietorship", vat_status: "vat", income_tax_option: "graduated_itemized", has_employees: false, withholds_expanded: false, taxpayer_size: "small" },
  },
  period: { from: "2026-07-01", to: "2026-09-30", label: "Third quarter 2026" },
  level: "intermediate",
  learningGoals: [
    "Record sales with output VAT added on the invoice",
    "Record purchases and equipment with input VAT you can claim",
    "Tell apart purchases from non-VAT suppliers, which carry no input VAT",
    "Record a collection net of 2% withholding by a top withholding agent",
    "Compute the quarterly VAT return (2550Q) from the Output VAT and Input VAT accounts",
  ],
  accounts: [
    { code: "101", name: "Cash on Hand", type: "asset", section: "current_assets" },
    { code: "102", name: "Cash in Bank", type: "asset", section: "current_assets" },
    { code: "110", name: "Accounts Receivable", type: "asset", section: "current_assets" },
    { code: "112", name: "Input VAT", type: "asset", section: "current_assets", description: "VAT on purchases from VAT-registered suppliers; deducted from output VAT." },
    { code: "115", name: "Creditable Withholding Tax", type: "asset", section: "current_assets", description: "Income tax withheld by clients (Form 2307); credited against income tax, not VAT." },
    { code: "150", name: "Printing Equipment", type: "asset", section: "noncurrent_assets" },
    { code: "151", name: "Accumulated Depreciation – Printing Equipment", type: "asset", section: "noncurrent_assets", contra: true },
    { code: "201", name: "Accounts Payable", type: "liability", section: "current_liabilities" },
    { code: "210", name: "Output VAT", type: "liability", section: "current_liabilities", description: "VAT added to your sales invoices; owed to the BIR less input VAT." },
    { code: "211", name: "VAT Payable", type: "liability", section: "current_liabilities", description: "Net VAT from the last 2550Q, not yet paid." },
    { code: "220", name: "Accrued Expenses", type: "liability", section: "current_liabilities" },
    { code: "301", name: "Carlo Mendoza, Capital", type: "equity", section: "equity" },
    { code: "302", name: "Carlo Mendoza, Drawing", type: "equity", section: "equity", contra: true },
    { code: "399", name: "Income Summary", type: "equity", section: "temporary" },
    { code: "401", name: "Printing Services Revenue", type: "revenue", section: "revenue" },
    { code: "501", name: "Printing Supplies Expense", type: "expense", section: "expenses" },
    { code: "502", name: "Delivery Expense", type: "expense", section: "expenses" },
    { code: "503", name: "Utilities Expense", type: "expense", section: "expenses" },
    { code: "504", name: "Depreciation Expense", type: "expense", section: "expenses" },
  ],
  opening: {
    date: "2026-07-01",
    memo: "Opening balances, including the net VAT for Q2 still to be paid",
    lines: [
      { account: "102", debit: "120000.00" },
      { account: "150", debit: "180000.00" },
      { account: "211", credit: "9600.00" },
      { account: "301", credit: "290400.00" },
    ],
  },
  transactions: [
    {
      id: "t01", date: "2026-07-03", book: "PJ",
      narrative: `Bought paper and ink from InkWorld Corp. (VAT-registered) on credit: ${peso(ink1.base)} plus ${peso(ink1.vat)} VAT, total ${peso(ink1.gross)}.`,
      document: { type: "supplier_invoice", number: "IW-1188", party: "InkWorld Corp.", details: `Paper and ink ${peso(ink1.base)}; VAT ${peso(ink1.vat)}; total ${peso(ink1.gross)}` },
      answer: [{ account: "501", debit: ink1.base }, { account: "112", debit: ink1.vat }, { account: "201", credit: ink1.gross }],
      explanation: "The cost of the supplies is the amount before VAT. The VAT you paid is Input VAT, an asset you deduct from the VAT you charge customers.",
      ownerTip: "You can claim input VAT only with a valid VAT invoice from a VAT-registered supplier.",
    },
    {
      id: "t02", date: "2026-07-08", book: "SJ",
      narrative: `Printed brochures for Lakbay Travel Inc. and billed ${peso(lakbay.base)} plus ${peso(lakbay.vat)} VAT, total ${peso(lakbay.gross)}, payable in 30 days.`,
      document: { type: "sales_invoice", number: "SI 2051", party: "Lakbay Travel Inc.", details: `Brochure printing ${peso(lakbay.base)}; VAT ${peso(lakbay.vat)}; total ${peso(lakbay.gross)}` },
      answer: [{ account: "110", debit: lakbay.gross }, { account: "401", credit: lakbay.base }, { account: "210", credit: lakbay.vat }],
      explanation: "Revenue is the amount before VAT. The VAT you charge is Output VAT, owed to the BIR. The customer owes the total.",
    },
    {
      id: "t03", date: "2026-07-12", book: "CRB",
      narrative: `Walk-in printing sales for the week, paid in cash: ${peso(walkin1.base)} plus ${peso(walkin1.vat)} VAT, total ${peso(walkin1.gross)}.`,
      document: { type: "sales_invoice", details: `Summary of cash sales invoices: ${peso(walkin1.base)} + VAT ${peso(walkin1.vat)}` },
      answer: [{ account: "101", debit: walkin1.gross }, { account: "401", credit: walkin1.base }, { account: "210", credit: walkin1.vat }],
      explanation: "Same split as a credit sale, but the cash comes in now.",
    },
    {
      id: "t04", date: "2026-07-15", book: "CDB",
      narrative: "Paid ₱1,200 cash to a tricycle driver (not VAT-registered) for deliveries to customers.",
      document: { type: "cash_voucher", number: "CV-0715", party: "Ben Ramos", details: "Deliveries, ₱1,200.00 (non-VAT receipt)" },
      answer: [{ account: "502", debit: "1200.00" }, { account: "101", credit: "1200.00" }],
      explanation: "A non-VAT supplier's receipt has no VAT to claim, so the whole amount is the expense.",
      ownerTip: "Check whether a supplier is VAT-registered before you record input VAT.",
    },
    {
      id: "t05", date: "2026-07-24", book: "CDB",
      narrative: "Paid the ₱9,600 VAT due on the Q2 2550Q from the bank account.",
      document: { type: "bank_statement", details: "BIR payment, 2550Q Q2 2026, ₱9,600.00" },
      answer: [{ account: "211", debit: "9600.00" }, { account: "102", credit: "9600.00" }],
      explanation: "Paying last quarter's VAT clears the VAT Payable that was in the opening balances.",
    },
    {
      id: "t06", date: "2026-08-05", book: "CRB",
      narrative: `Lakbay Travel Inc., a top withholding agent, paid SI 2051 after withholding 2% on the amount before VAT. Carlo received ${peso(lakbayEwt.net_payment)} and a Form 2307 for ${peso(lakbayEwt.ewt)}.`,
      document: { type: "form_2307", party: "Lakbay Travel Inc.", details: `Income payment ${peso(lakbayEwt.tax_base)}; tax withheld ${peso(lakbayEwt.ewt)} (ATC WI160)` },
      answer: [{ account: "102", debit: lakbayEwt.net_payment }, { account: "115", debit: lakbayEwt.ewt }, { account: "110", credit: lakbay.gross }],
      explanation: "The whole receivable is cleared. The 2% is withheld on the amount before VAT and is a credit against income tax, so it goes to Creditable Withholding Tax, not to the VAT accounts.",
    },
    {
      id: "t07", date: "2026-08-10", book: "CDB",
      narrative: `Paid InkWorld Corp. the ${peso(ink1.gross)} owed on invoice IW-1188.`,
      document: { type: "official_receipt", party: "InkWorld Corp.", details: `Payment of IW-1188, ${peso(ink1.gross)}` },
      answer: [{ account: "201", debit: ink1.gross }, { account: "102", credit: ink1.gross }],
      explanation: "Paying the supplier clears the payable, VAT included.",
    },
    {
      id: "t08", date: "2026-08-14", book: "CDB",
      narrative: `Bought a laminating machine from OfficePro (VAT-registered) for ${peso(laminator.base)} plus ${peso(laminator.vat)} VAT, paid by bank transfer.`,
      document: { type: "supplier_invoice", number: "OP-5530", party: "OfficePro", details: `Laminating machine ${peso(laminator.base)}; VAT ${peso(laminator.vat)}; total ${peso(laminator.gross)}` },
      answer: [{ account: "150", debit: laminator.base }, { account: "112", debit: laminator.vat }, { account: "102", credit: laminator.gross }],
      explanation: "Equipment is recorded at its cost before VAT; the VAT is input VAT.",
      ownerTip: "Input VAT on capital goods may have special rules on when it can be claimed; confirm with your CPA.",
    },
    {
      id: "t09", date: "2026-08-20", book: "SJ",
      narrative: `Printed tarpaulins for Sunrise Bakeshop and billed ${peso(sunrise.base)} plus ${peso(sunrise.vat)} VAT, payable in 15 days.`,
      document: { type: "sales_invoice", number: "SI 2063", party: "Sunrise Bakeshop", details: `Tarpaulin printing ${peso(sunrise.base)}; VAT ${peso(sunrise.vat)}; total ${peso(sunrise.gross)}` },
      answer: [{ account: "110", debit: sunrise.gross }, { account: "401", credit: sunrise.base }, { account: "210", credit: sunrise.vat }],
      explanation: "A sale on account with output VAT.",
    },
    {
      id: "t10", date: "2026-08-28", book: "GJ",
      narrative: "Deposited ₱26,000 of the cash on hand into the bank.",
      document: { type: "deposit_slip", details: "Cash deposit, ₱26,000.00" },
      answer: [{ account: "102", debit: "26000.00" }, { account: "101", credit: "26000.00" }],
      explanation: "A transfer between cash accounts.",
    },
    {
      id: "t11", date: "2026-09-04", book: "CRB",
      narrative: `Walk-in printing sales, paid in cash: ${peso(walkin2.base)} plus ${peso(walkin2.vat)} VAT, total ${peso(walkin2.gross)}.`,
      document: { type: "sales_invoice", details: `Summary of cash sales invoices: ${peso(walkin2.base)} + VAT ${peso(walkin2.vat)}` },
      answer: [{ account: "101", debit: walkin2.gross }, { account: "401", credit: walkin2.base }, { account: "210", credit: walkin2.vat }],
      explanation: "Cash sales with output VAT.",
    },
    {
      id: "t12", date: "2026-09-10", book: "CDB",
      narrative: `Paid the July–August electricity bill: ${peso(meralco.base)} plus ${peso(meralco.vat)} VAT, from the bank account.`,
      document: { type: "bank_statement", details: `Electricity bill ${peso(meralco.base)}; VAT ${peso(meralco.vat)}` },
      answer: [{ account: "503", debit: meralco.base }, { account: "112", debit: meralco.vat }, { account: "102", credit: meralco.gross }],
      explanation: "The utility company is VAT-registered, so the VAT on the bill is input VAT.",
    },
    {
      id: "t13", date: "2026-09-15", book: "CRB",
      narrative: `Sunrise Bakeshop paid SI 2063 in full, ${peso(sunrise.gross)}, by bank transfer.`,
      document: { type: "bank_statement", details: `Deposit from Sunrise Bakeshop, ${peso(sunrise.gross)}` },
      answer: [{ account: "102", debit: sunrise.gross }, { account: "110", credit: sunrise.gross }],
      explanation: "Collecting a receivable; the VAT was already recorded when you billed.",
    },
    {
      id: "t14", date: "2026-09-20", book: "PJ",
      narrative: `Bought more paper from InkWorld Corp. on credit: ${peso(ink2.base)} plus ${peso(ink2.vat)} VAT.`,
      document: { type: "supplier_invoice", number: "IW-1307", party: "InkWorld Corp.", details: `Paper ${peso(ink2.base)}; VAT ${peso(ink2.vat)}; total ${peso(ink2.gross)}` },
      answer: [{ account: "501", debit: ink2.base }, { account: "112", debit: ink2.vat }, { account: "201", credit: ink2.gross }],
      explanation: "A credit purchase with input VAT, still unpaid at quarter end.",
    },
    {
      id: "t15", date: "2026-09-25", book: "CDB",
      narrative: "Carlo transferred ₱20,000 from the business account for personal expenses.",
      document: { type: "bank_statement", details: "Transfer to personal account, ₱20,000.00" },
      answer: [{ account: "302", debit: "20000.00" }, { account: "102", credit: "20000.00" }],
      explanation: "A personal withdrawal, not an expense.",
    },
    {
      id: "t16", date: "2026-09-30", book: "GJ",
      narrative: "Deposited ₱35,000 of the cash on hand into the bank.",
      document: { type: "deposit_slip", details: "Cash deposit, ₱35,000.00" },
      answer: [{ account: "102", debit: "35000.00" }, { account: "101", credit: "35000.00" }],
      explanation: "A transfer between cash accounts.",
    },
  ],
  adjustments: [
    {
      id: "a01", date: "2026-09-30", book: "GJ",
      narrative: "Record depreciation for the quarter: printing equipment (₱180,000, 5-year life) for 3 months, and the laminator (₱24,000, 5-year life) for September only. Straight-line, no salvage value.",
      answer: [{ account: "504", debit: "9400.00" }, { account: "151", credit: "9400.00" }],
      explanation: "Printing equipment: ₱180,000 ÷ 60 × 3 = ₱9,000. Laminator: ₱24,000 ÷ 60 × 1 = ₱400. Total ₱9,400.",
    },
    {
      id: "a02", date: "2026-09-30", book: "GJ",
      narrative: "September's electricity, estimated at ₱3,000 from the meter reading, has not been billed yet.",
      answer: [{ account: "503", debit: "3000.00" }, { account: "220", credit: "3000.00" }],
      explanation: "The electricity was used in September, so it is an expense of the quarter even though the bill comes later.",
      ownerTip: "Record the input VAT only when you receive the VAT invoice, not on the estimate.",
    },
  ],
  incomeSummaryAccount: "399",
  earningsAccount: "301",
  books: ["CRB", "CDB", "SJ", "PJ", "GJ"],
  returns: () => {
    const v = computeVat(
      { period_end: "2026-09-30", vatable_sales: sum(salesBases), sales_vat_inclusive: false, vatable_purchases: sum(purchaseBases), purchases_vat_inclusive: false },
      taxRules,
    );
    return [
      {
        form: "2550Q",
        title: "Quarterly VAT return",
        period: "Q3 2026 (due 25 days after September 30)",
        steps: v.steps,
        summary: `Output VAT ${peso(v.result.output_vat)} less input VAT ${peso(v.result.input_vat)}: pay ${peso(v.result.vat_payable)} with the 2550Q.`,
        notes: [
          "The amounts tie to the Output VAT and Input VAT accounts in the ledger.",
          "The 2% withheld by Lakbay Travel is an income tax credit (Form 2307) for the 1701Q, not a VAT credit.",
          "Keep the summary list of sales and purchases the BIR requires with the return.",
        ],
      },
    ];
  },
  needs_verification: true,
};
