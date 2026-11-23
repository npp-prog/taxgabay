/**
 * Adds everything built since the review worksheet was made to its items.json, keeping existing
 * items (and their ids, which carry the CPA's saved answers) unchanged.
 *   tsx packages/filing/scripts/review-items.ts <items.json>
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { practiceContext, practiceSets } from "@taxgabay/accounting";
import { employerRules } from "@taxgabay/tax-engine";
import { formLines } from "../src/data/form-lines";

interface Item { id: string; section: string; title: string; value: string; basis: string; note: string; file: string; priority: boolean }

const root = join(import.meta.dirname, "..", "..", "..");
const path = process.argv[2]!;
const existing = JSON.parse(readFileSync(path, "utf8")) as Item[];
const have = new Set(existing.map((i) => i.id));
const add: Item[] = [];
const push = (i: Omit<Item, "basis" | "note" | "file" | "priority"> & Partial<Item>) => {
  if (!have.has(i.id)) add.push({ basis: "", note: "", file: "", priority: false, ...i });
};
const fm = (src: string, key: string) => (new RegExp(`^${key}:\\s*"?(.*?)"?\\s*$`, "m").exec(src)?.[1] ?? "").trim();
const flat = (o: unknown): string => (o && typeof o === "object" ? Object.entries(o).map(([k, v]) => (v && typeof v === "object" ? `${k}: {${flat(v)}}` : `${k}=${v}`)).join(", ") : String(o));

// 1. Employer, bookkeeping and LGU rules.
for (const r of employerRules) {
  const note = (r as unknown as { notes?: string; note?: string }).notes ?? (r as unknown as { note?: string }).note ?? "";
  push({
    id: `rule_${r.id}`,
    section: "Employer, bookkeeping and LGU rules",
    title: `${r.rule_key} (${r.category})`,
    value: `${flat(r.value)}\nEffective ${r.effective_from} → ${r.effective_to ?? "open"}`,
    basis: r.legal_basis,
    note,
    file: "packages/tax-engine/src/data/employer-rules.ts",
    priority: /LOW CONFIDENCE/i.test(note),
  });
}

// 2. Contributions worked examples (tax engine fixture).
const contrib = JSON.parse(readFileSync(join(root, "packages/tax-engine/test/fixtures/contributions.json"), "utf8")) as { cases: { name: string; input: unknown; expected: unknown }[] };
contrib.cases.forEach((c, i) => push({ id: `fx_contributions_json_cases_${i}`, section: "Worked examples", title: `contributions: ${c.name}`, value: `Input: ${flat(c.input)}\nExpected: ${flat(c.expected)}`, file: "packages/tax-engine/test/fixtures/contributions.json" }));

// 3. New filing guides.
for (const f of readdirSync(join(root, "packages/content/guides")).filter((x) => x.endsWith(".mdx"))) {
  const src = readFileSync(join(root, "packages/content/guides", f), "utf8");
  push({ id: `guide_${f.replace(".", "_")}`, section: "Guides and articles", title: fm(src, "title"), value: 'New guide. Read it on the site; facts marked "(to confirm)" need checking and the field-by-field walkthrough is still a TODO.', file: `packages/content/guides/${f}` });
}

// 4. Business guide chapters.
for (const f of readdirSync(join(root, "packages/content/business")).filter((x) => x.endsWith(".mdx"))) {
  const src = readFileSync(join(root, "packages/content/business", f), "utf8");
  const slug = f.replace(".mdx", "");
  push({ id: `business_${slug}`, section: "Business guide", title: fm(src, "title"), value: `${fm(src, "summary")}\nRead it at /business-guide/${slug}. Facts marked "(to confirm)" need checking.`, file: `packages/content/business/${f}` });
}

// 5. Practice sets.
for (const s of practiceSets) {
  const ctx = practiceContext(s);
  const returns = s.returns(ctx).map((r) => `${r.form} (${r.period}): ${r.summary}`).join("\n");
  push({ id: `practice_${s.slug}`, section: "Practice sets", title: `${s.title} — ${s.business.description.slice(0, 80)}`, value: `${s.summary}\n${s.transactions.length} transactions, ${s.adjustments.length} adjustments. Check each journal entry and explanation at /practice/${s.slug} (Worked example tab).\nReturns from the books:\n${returns}`, file: `packages/accounting/src/sets/` });
}

// 6. Prepared-document form boxes (BIR item numbers left blank).
for (const l of formLines) {
  push({
    id: `line_${l.form}_${l.field_key}`,
    section: "Prepared documents: form boxes",
    title: `${l.form} — ${l.label}`,
    value: `BIR item number: ${l.item ?? "(blank)"}\nIf this box exists on the current ${l.form}, mark ✗ and type its item number (and the form version) in the comment; mark ✓ only if the description is right and you are happy to leave the number blank.`,
    basis: l.legal_basis,
    file: "packages/filing/src/data/form-lines.ts",
  });
}

// 7. Prepared-document worked examples.
const fxDir = join(root, "packages/filing/test/fixtures");
for (const f of readdirSync(fxDir).filter((x) => x.endsWith(".json"))) {
  const fx = JSON.parse(readFileSync(join(fxDir, f), "utf8")) as { description: string; expected: { forms: string[]; values: Record<string, Record<string, string>>; total_payable: string; books?: Record<string, unknown> } };
  const vals = Object.entries(fx.expected.values).map(([doc, v]) => `${doc}: ${Object.entries(v).map(([k, x]) => `${k}=${x}`).join(", ")}`).join("\n");
  const books = fx.expected.books ? `\nBooks: ${flat(fx.expected.books)}` : "";
  push({ id: `prep_${f.replace(".json", "")}`, section: "Prepared documents: worked examples", title: f.replace(".json", "").replace(/-/g, " "), value: `${fx.description}\nDocuments: ${fx.expected.forms.join(", ")}\n${vals}\nTotal to pay: ${fx.expected.total_payable}${books}`, file: `packages/filing/test/fixtures/${f}` });
}

// 8. Assumptions behind the prepared documents.
const ASSUMPTIONS: [string, string][] = [
  ["Sales counted by invoice date", "Income tax and percentage tax/VAT count sales on the invoice date (accrual), not when collected."],
  ["Earlier returns paid as prepared", "The 1701Q/1702Q deduct earlier quarters' tax as prepared by TaxGabay; the 1601EQ deducts the 0619E as prepared."],
  ["Zero 0619E", "Whether a 0619E with nothing withheld must still be filed is left as a note to the CPA."],
  ["Summary lists and alphalists", "SAWT, QAP, summary lists of sales/purchases and the 1604C alphalist are given as lists and CSV; the BIR data-file (DAT) formats are not produced until confirmed."],
  ["VAT input tax", "Input tax is claimed for every purchase from a VAT-registered supplier (valid VAT invoice assumed); input tax on capital goods is not spread over time."],
  ["Income tax for VAT clients", "Income tax uses sales net of VAT; itemized deductions exclude input tax."],
  ["Payroll withholding", "Monthly withholding on basic pay less employee contributions (monthly table); 13th month and benefits taxed only at the December year-end adjustment; minimum wage earners fully exempt; December refunds when over-withheld."],
  ["Contributions", "SSS, PhilHealth and Pag-IBIG computed from basic pay; SSS EC and WISP not included; remittance due dates left blank."],
  ["Corporations", "Gross income = sales − cost of sales; all other expenses, payroll and depreciation deducted (no 40% OSD); regular rate used when assets are not entered; MCIT computed every quarter on gross income to date; excess MCIT, NOLCO and final-tax income not modeled; partnerships assumed taxable."],
  ["Fiscal years", "Supported for corporations with years ending March, June or September; fiscal years are named by the year they end; withholding and payroll stay on the calendar."],
  ["Mixed income", "The 1701Q taxes business income alone (8% with no ₱250,000 reduction, or graduated rates on business income only); the 1701 adds 2316 compensation and deducts tax withheld on it."],
  ["Books", "Cash basis: sales to the cash receipts book, expenses and payroll to the cash disbursements book, Forms 2307 to the general journal at the end of the period they cover; equipment capitalized; depreciation, opening balances, remittances and withdrawals are manual journal entries; income tax expense not booked."],
  ["Records due before deadlines", "Clients are asked for complete records 10 days before each filing deadline (a firm working rule, not a BIR rule)."],
  ["Retention of client records", "Retention period for client records and receipts is still to be decided (privacy notice says 'to be confirmed')."],
];
for (const [t, v] of ASSUMPTIONS) push({ id: `model_prep_${t.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, section: "Modeling decisions", title: `Prepared documents: ${t}`, value: v, file: "docs/VERIFY.md" });

writeFileSync(path, JSON.stringify([...existing, ...add], null, 1));
console.log(`Kept ${existing.length}, added ${add.length}:`, Object.entries(add.reduce<Record<string, number>>((a, i) => ((a[i.section] = (a[i.section] ?? 0) + 1), a), {})));
