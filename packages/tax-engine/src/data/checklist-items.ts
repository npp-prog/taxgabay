import type { AppliesWhen, TaxpayerType } from "../profile";

export type ChecklistFrequency = "monthly" | "quarterly" | "annual" | "one_time";

export interface ChecklistItem {
  id: string;
  frequency: ChecklistFrequency;
  title: string;
  detail: string;
  applies_when: AppliesWhen;
  /** Monthly items: only in these kinds of months. */
  months?: "non_quarter_end" | "quarter_end";
  /** Quarterly items: only in these quarters (of the calendar year). */
  quarters?: number[];
  form_code: string | null;
  due_hint: string;
  legal_basis: string;
  needs_verification: boolean;
}

const IND_BIZ: TaxpayerType[] = ["self_employed", "mixed_income", "sole_proprietorship"];
const JUR: TaxpayerType[] = ["partnership", "corporation", "opc", "cooperative"];
const BIZ: TaxpayerType[] = [...IND_BIZ, ...JUR];

function item(i: Omit<ChecklistItem, "needs_verification">): ChecklistItem {
  return { ...i, needs_verification: true };
}

export const checklistItems: ChecklistItem[] = [
  // ---------- Monthly ----------
  item({ id: "m-books", frequency: "monthly", title: "Update your books of accounts", detail: "Record every sale and expense for the month in your registered books.", applies_when: { taxpayer_types: BIZ }, form_code: null, due_hint: "Throughout the month", legal_basis: "NIRC Sec. 232" }),
  item({ id: "m-invoices", frequency: "monthly", title: "Check that every sale has an invoice", detail: "Under the Ease of Paying Taxes Act, issue a sales invoice for each sale of goods or services and keep your copies.", applies_when: { taxpayer_types: BIZ }, form_code: null, due_hint: "At each sale", legal_basis: "NIRC Secs. 113 and 237, as amended by RA 11976" }),
  item({ id: "m-1601c", frequency: "monthly", title: "File and pay 1601C (tax withheld from employees)", detail: "Remit the tax you withheld from salaries this month.", applies_when: { has_employees: true }, form_code: "1601C", due_hint: "10th of next month (15 January for December)", legal_basis: "NIRC Sec. 58(A); RR 2-98" }),
  item({ id: "m-contributions", frequency: "monthly", title: "Remit SSS, PhilHealth and Pag-IBIG contributions", detail: "Pay employer and employee shares for the month.", applies_when: { has_employees: true }, form_code: null, due_hint: "Per each agency's schedule", legal_basis: "RA 11199; RA 11223; RA 9679" }),
  item({ id: "m-0619e", frequency: "monthly", title: "File and pay 0619E (expanded withholding)", detail: "Remit expanded withholding tax for the month.", applies_when: { withholds_expanded: true }, months: "non_quarter_end", form_code: "0619E", due_hint: "10th of next month", legal_basis: "NIRC Sec. 58(A); RR 11-2018" }),

  // ---------- Quarterly ----------
  item({ id: "q-1701q", frequency: "quarterly", title: "File 1701Q (quarterly income tax)", detail: "Report cumulative income for the year to date and pay any tax due.", applies_when: { taxpayer_types: IND_BIZ }, quarters: [1, 2, 3], form_code: "1701Q", due_hint: "15 May, 15 Aug, 15 Nov", legal_basis: "NIRC Sec. 74" }),
  item({ id: "q-1702q", frequency: "quarterly", title: "File 1702Q (quarterly corporate income tax)", detail: "For the first three quarters of your taxable year.", applies_when: { taxpayer_types: JUR }, form_code: "1702Q", due_hint: "Within 60 days after the quarter", legal_basis: "NIRC Sec. 77(B)" }),
  item({ id: "q-2551q", frequency: "quarterly", title: "File 2551Q (percentage tax)", detail: "3% of gross sales or receipts for the quarter.", applies_when: { taxpayer_types: BIZ, vat_status: ["non_vat"], not: { income_tax_options: ["eight_percent"] } }, form_code: "2551Q", due_hint: "25 days after the quarter", legal_basis: "NIRC Secs. 116 and 128" }),
  item({ id: "q-2550q", frequency: "quarterly", title: "File 2550Q (VAT) and the Summary List of Sales and Purchases", detail: "Output VAT less input VAT for the quarter.", applies_when: { taxpayer_types: BIZ, vat_status: ["vat"] }, form_code: "2550Q", due_hint: "25 days after the quarter", legal_basis: "NIRC Sec. 114" }),
  item({ id: "q-1601eq", frequency: "quarterly", title: "File 1601EQ with the Quarterly Alphalist of Payees", detail: "Quarterly summary and remittance of expanded withholding tax.", applies_when: { withholds_expanded: true }, form_code: "1601EQ", due_hint: "Last day of the month after the quarter", legal_basis: "NIRC Sec. 58(A); RR 11-2018" }),
  item({ id: "q-2307-issue", frequency: "quarterly", title: "Give BIR Form 2307 to the suppliers you withheld from", detail: "Your payees need these certificates to claim tax credits.", applies_when: { withholds_expanded: true }, form_code: null, due_hint: "Within 20 days after the quarter (to confirm)", legal_basis: "RR 2-98 Sec. 2.58(B), as amended" }),
  item({ id: "q-2307-collect", frequency: "quarterly", title: "Collect BIR Form 2307 from clients who withheld from you", detail: "Attach them to your quarterly income tax return to claim the credit.", applies_when: { taxpayer_types: BIZ }, form_code: null, due_hint: "Before you file your quarterly income tax return", legal_basis: "RR 2-98 Sec. 2.58.3" }),

  // ---------- Annual ----------
  item({ id: "a-itr-ind", frequency: "annual", title: "File your annual income tax return (1701 or 1701A) for last year", detail: "Use 1701A if you are purely self-employed on 8% or OSD; otherwise 1701.", applies_when: { taxpayer_types: IND_BIZ }, form_code: "1701A", due_hint: "15 April", legal_basis: "NIRC Sec. 51(C)(1)" }),
  item({ id: "a-itr-corp", frequency: "annual", title: "File your annual corporate income tax return (1702) with financial statements", detail: "Attach the audited financial statements where required.", applies_when: { taxpayer_types: JUR }, form_code: "1702-RT", due_hint: "15th day of the 4th month after year end", legal_basis: "NIRC Sec. 77(B)" }),
  item({ id: "a-1604c", frequency: "annual", title: "File 1604C with the alphalist of employees", detail: "Annual information return of tax withheld on compensation.", applies_when: { has_employees: true }, form_code: "1604C", due_hint: "31 January", legal_basis: "NIRC Sec. 58(C)" }),
  item({ id: "a-2316", frequency: "annual", title: "Give each employee their BIR Form 2316", detail: "Certificate of compensation and tax withheld for last year.", applies_when: { has_employees: true }, form_code: null, due_hint: "31 January (to confirm)", legal_basis: "NIRC Sec. 83, as amended by RA 10963" }),
  item({ id: "a-1604e", frequency: "annual", title: "File 1604E with the alphalist of payees", detail: "Annual information return of expanded withholding.", applies_when: { withholds_expanded: true }, form_code: "1604E", due_hint: "1 March", legal_basis: "NIRC Sec. 58(C)" }),
  item({ id: "a-inventory", frequency: "annual", title: "Submit your year-end inventory list (if you sell goods)", detail: "List of inventory as of the end of the taxable year.", applies_when: { taxpayer_types: BIZ }, form_code: null, due_hint: "Within 30 days after year end (to confirm)", legal_basis: "RR 17-2013 (to confirm)" }),
  item({ id: "a-books-close", frequency: "annual", title: "Close and keep your books for last year", detail: "Bind loose-leaf books and keep records for the period required by law.", applies_when: { taxpayer_types: BIZ }, form_code: null, due_hint: "Early in the year", legal_basis: "NIRC Secs. 232 and 235, as amended by RA 11976" }),
  item({ id: "a-mayors-permit", frequency: "annual", title: "Renew your mayor's/business permit", detail: "Renew with your city or municipality and pay local business tax.", applies_when: { taxpayer_types: BIZ }, form_code: null, due_hint: "By 20 January (LGU deadline varies)", legal_basis: "RA 7160 Sec. 167" }),

  // ---------- One-time ----------
  item({ id: "o-post-cor", frequency: "one_time", title: "Display your Certificate of Registration and \"Ask for an invoice\" notice", detail: "Post them where customers can see.", applies_when: { taxpayer_types: BIZ }, form_code: null, due_hint: "When you start operating", legal_basis: "NIRC Sec. 236" }),
  item({ id: "o-books-register", frequency: "one_time", title: "Register your books of accounts", detail: "Before you use them.", applies_when: { taxpayer_types: BIZ }, form_code: null, due_hint: "Before you start operating", legal_basis: "NIRC Sec. 232" }),
  item({ id: "o-invoices", frequency: "one_time", title: "Get an Authority to Print or register your invoicing system", detail: "So you can issue BIR-registered invoices.", applies_when: { taxpayer_types: BIZ }, form_code: null, due_hint: "Before your first sale", legal_basis: "NIRC Sec. 238; RR 7-2024" }),
  item({ id: "o-8pct-election", frequency: "one_time", title: "Elect the 8% option in your first quarterly return of the year", detail: "The election is irrevocable for the year.", applies_when: { taxpayer_types: IND_BIZ, income_tax_options: ["eight_percent"] }, form_code: "1701Q", due_hint: "First quarterly return (15 May)", legal_basis: "RR 8-2018" }),
];
