import { financialStatements, post, trialBalance, type Chart, type JournalEntry, type PracticeContext } from "@taxgabay/accounting";
import { peso } from "@taxgabay/tax-engine";
import { stepsToTable, type PdfBlock, type PdfDoc } from "./pdf";

const p = (v: string | null | undefined) => (v ? peso(v) : "");

function journalBlock(entries: readonly JournalEntry[], chart: Chart): PdfBlock {
  const rows: string[][] = [];
  for (const e of entries) {
    e.lines.forEach((l, i) => rows.push([i === 0 ? e.date : "", `${l.credit ? "    " : ""}${chart.get(l.account)?.name ?? l.account}`, p(l.debit), p(l.credit)]));
    rows.push(["", e.memo, "", ""]);
  }
  return {
    kind: "table",
    columns: [
      { label: "Date", width: 0.14 },
      { label: "Account and explanation", width: 0.54 },
      { label: "Debit", width: 0.16, align: "right" },
      { label: "Credit", width: 0.16, align: "right" },
    ],
    rows,
  };
}

/** Full worked solution of a practice set: journal, trial balance, statements, returns. */
export function workedExamplePdf(ctx: PracticeContext, generatedOn: string): PdfDoc {
  const { set, chart, entries } = ctx;
  const tb = trialBalance(post(entries, chart));
  const fs = financialStatements(entries, chart, set.period.to, set.earningsAccount);
  const blocks: PdfBlock[] = [
    { kind: "paragraph", text: `${set.business.name} — ${set.business.description}` },
    { kind: "heading", text: "Journal entries" },
    journalBlock(entries, chart),
    { kind: "heading", text: "Adjusted trial balance" },
    {
      kind: "table",
      columns: [
        { label: "Account", width: 0.6 },
        { label: "Debit", width: 0.2, align: "right" },
        { label: "Credit", width: 0.2, align: "right" },
      ],
      rows: [...tb.rows.map((r) => [`${r.code} ${r.name}`, p(r.debit), p(r.credit)]), ["Total", peso(tb.totalDebit), peso(tb.totalCredit)]],
    },
    { kind: "heading", text: "Financial statements" },
    {
      kind: "keyValue",
      rows: [
        ["Revenue", peso(fs.incomeStatement.revenue.total)],
        ["Cost of sales", peso(fs.incomeStatement.costOfSales.total)],
        ["Operating expenses", peso(fs.incomeStatement.expenses.total)],
        ["Net income", peso(fs.incomeStatement.netIncome)],
        ["Total assets", peso(fs.balanceSheet.totalAssets)],
        ["Total liabilities", peso(fs.balanceSheet.totalLiabilities)],
        ["Total equity", peso(fs.balanceSheet.totalEquity)],
      ],
    },
  ];
  for (const r of set.returns(ctx)) {
    blocks.push({ kind: "heading", text: `BIR Form ${r.form} — ${r.period}` }, { kind: "paragraph", text: r.summary }, stepsToTable(r.steps));
  }
  blocks.push({ kind: "paragraph", text: "Fictional business for practice. Tax figures use rule tables still awaiting CPA verification." });
  return { title: `${set.title} — worked solution`, subtitle: set.period.label, generatedOn, blocks };
}

/** Blank bookkeeping forms to print and fill by hand. */
export function blankFormsPdf(kind: "journal" | "ledger" | "cash", generatedOn: string): PdfDoc {
  const empty = (cols: number, n: number) => Array.from({ length: n }, () => Array.from({ length: cols }, () => " "));
  const forms: Record<typeof kind, { title: string; block: PdfBlock }> = {
    journal: {
      title: "General journal (blank)",
      block: {
        kind: "table",
        columns: [
          { label: "Date", width: 0.12 },
          { label: "Account titles and explanation", width: 0.46 },
          { label: "Ref", width: 0.08 },
          { label: "Debit", width: 0.17, align: "right" },
          { label: "Credit", width: 0.17, align: "right" },
        ],
        rows: empty(5, 32),
      },
    },
    ledger: {
      title: "General ledger account (blank)",
      block: {
        kind: "table",
        columns: [
          { label: "Date", width: 0.12 },
          { label: "Explanation", width: 0.34 },
          { label: "Ref", width: 0.08 },
          { label: "Debit", width: 0.15, align: "right" },
          { label: "Credit", width: 0.15, align: "right" },
          { label: "Balance", width: 0.16, align: "right" },
        ],
        rows: empty(6, 32),
      },
    },
    cash: {
      title: "Cash receipts / disbursements book (blank)",
      block: {
        kind: "table",
        columns: [
          { label: "Date", width: 0.1 },
          { label: "OR/CV no.", width: 0.12 },
          { label: "Received from / paid to", width: 0.3 },
          { label: "Account", width: 0.18 },
          { label: "Cash", width: 0.15, align: "right" },
          { label: "Other", width: 0.15, align: "right" },
        ],
        rows: empty(6, 32),
      },
    },
  };
  const f = forms[kind];
  return { title: f.title, subtitle: "Account name: ____________________   Page: ____", generatedOn, blocks: [f.block] };
}
