import type { ClientRecord, ExpenseCategory } from "@taxgabay/filing";

/** CSV templates clients can fill in a spreadsheet and import. */
export const TEMPLATES = {
  sale: { file: "taxgabay-sales.csv", columns: ["date", "invoice_no", "customer_name", "customer_tin", "amount", "vat_treatment"], example: ["2026-01-10", "SI-0001", "Kape Co., Inc.", "201-111-222-000", "30000.00", ""] },
  expense: {
    file: "taxgabay-expenses.csv",
    columns: ["date", "document_no", "supplier_name", "supplier_tin", "category", "amount", "supplier_vat_registered", "atc"],
    example: ["2026-01-31", "OR-551", "Jose Cruz", "301-555-666-000", "rent", "10000.00", "no", "WI100"],
  },
  form_2307_received: {
    file: "taxgabay-2307-received.csv",
    columns: ["date_received", "payor_name", "payor_tin", "period_from", "period_to", "atc", "income_payment", "tax_withheld"],
    example: ["2026-04-05", "Kape Co., Inc.", "201-111-222-000", "2026-01-01", "2026-03-31", "WI010", "70000.00", "3500.00"],
  },
} as const;

export type TemplateKind = keyof typeof TEMPLATES;

export const CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "cost_of_sales", label: "Goods for resale / cost of sales" },
  { key: "rent", label: "Rent" },
  { key: "professional_fees", label: "Professional fees" },
  { key: "contractors", label: "Contractors and services" },
  { key: "utilities", label: "Utilities" },
  { key: "supplies", label: "Supplies" },
  { key: "salaries", label: "Salaries and wages" },
  { key: "taxes_licenses", label: "Taxes and licenses" },
  { key: "transportation", label: "Transportation" },
  { key: "communication", label: "Phone and internet" },
  { key: "repairs", label: "Repairs and maintenance" },
  { key: "equipment", label: "Equipment and other capital goods" },
  { key: "other", label: "Other" },
];

export function templateCsv(kind: TemplateKind): string {
  const t = TEMPLATES[kind];
  return [t.columns.join(","), t.example.map(csvCell).join(",")].join("\n") + "\n";
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** RFC 4180-style parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const cleanAmount = (v: string) => v.replace(/[₱,\s]/g, "");

export interface ImportResult {
  records: ClientRecord[];
  errors: string[];
}

/** Turns an imported CSV into records; every bad row is reported with its line number. */
export function importCsv(kind: TemplateKind, text: string, makeId: () => string): ImportResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  const records: ClientRecord[] = [];
  if (!rows.length) return { records, errors: ["The file is empty."] };
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const cols = TEMPLATES[kind].columns;
  const missing = cols.filter((c) => !header.includes(c) && !c.endsWith("_tin") && c !== "document_no" && c !== "supplier_vat_registered" && c !== "atc" && c !== "vat_treatment");
  if (missing.length) return { records, errors: [`Missing column(s): ${missing.join(", ")}. Download the template to see the expected columns.`] };
  const get = (r: string[], c: string) => (r[header.indexOf(c)] ?? "").trim();

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const bad = (msg: string) => errors.push(`Line ${line}: ${msg}`);
    const dateCol = kind === "form_2307_received" ? "date_received" : "date";
    const date = get(r, dateCol);
    if (!ISO.test(date)) return bad(`"${date}" is not a date in YYYY-MM-DD format.`);
    if (kind === "sale") {
      const amount = cleanAmount(get(r, "amount"));
      if (!AMOUNT.test(amount)) return bad(`amount "${get(r, "amount")}" is not a peso amount.`);
      if (!get(r, "invoice_no")) return bad("invoice_no is required.");
      const vt = get(r, "vat_treatment").toLowerCase().replace(/[\s-]+/g, "_");
      if (vt && !["vatable", "zero_rated", "exempt"].includes(vt)) return bad(`vat_treatment "${get(r, "vat_treatment")}" must be vatable, zero_rated or exempt (or blank).`);
      records.push({ kind: "sale", id: makeId(), date, document_no: get(r, "invoice_no"), customer: { name: get(r, "customer_name") || "Walk-in customer", tin: get(r, "customer_tin") || null }, amount, ...(vt ? { vat_treatment: vt as "vatable" | "zero_rated" | "exempt" } : {}) });
    } else if (kind === "expense") {
      const amount = cleanAmount(get(r, "amount"));
      if (!AMOUNT.test(amount)) return bad(`amount "${get(r, "amount")}" is not a peso amount.`);
      const category = get(r, "category").toLowerCase() as ExpenseCategory;
      if (!CATEGORIES.some((c) => c.key === category)) return bad(`category "${get(r, "category")}" must be one of: ${CATEGORIES.map((c) => c.key).join(", ")}.`);
      if (!get(r, "supplier_name")) return bad("supplier_name is required.");
      const atc = get(r, "atc").toUpperCase();
      records.push({
        kind: "expense",
        id: makeId(),
        date,
        document_no: get(r, "document_no") || undefined,
        supplier: { name: get(r, "supplier_name"), tin: get(r, "supplier_tin") || null },
        category,
        amount,
        supplier_vat_registered: /^(yes|y|true|1)$/i.test(get(r, "supplier_vat_registered")),
        withholding: atc ? { atc } : null,
      });
    } else {
      const from = get(r, "period_from");
      const to = get(r, "period_to");
      if (!ISO.test(from) || !ISO.test(to)) return bad("period_from and period_to must be dates in YYYY-MM-DD format.");
      const income = cleanAmount(get(r, "income_payment"));
      const tax = cleanAmount(get(r, "tax_withheld"));
      if (!AMOUNT.test(income) || !AMOUNT.test(tax)) return bad("income_payment and tax_withheld must be peso amounts.");
      if (!get(r, "payor_name") || !get(r, "atc")) return bad("payor_name and atc are required.");
      records.push({ kind: "form_2307_received", id: makeId(), date, payor: { name: get(r, "payor_name"), tin: get(r, "payor_tin") || null }, period_from: from, period_to: to, atc: get(r, "atc").toUpperCase(), income_payment: income, tax_withheld: tax });
    }
  });
  return { records, errors };
}
