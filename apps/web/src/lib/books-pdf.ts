import { BOOK_NAMES, financialStatements, post, trialBalance, type BookCode } from "@taxgabay/accounting";
import type { Books } from "@taxgabay/filing";
import { peso } from "@taxgabay/tax-engine";
import type { PdfBlock, PdfDoc } from "./pdf";

const p = (v: string | undefined) => (v ? peso(v) : "");

/** Books of accounts, trial balance and financial statements for a period, as a PDF. */
export function booksPdf(name: string, books: Books, from: string, to: string, generatedOn: string): PdfDoc {
  const blocks: PdfBlock[] = [];
  for (const code of ["CRB", "CDB", "GJ"] as BookCode[]) {
    const es = books.entries.filter((e) => e.book === code);
    if (!es.length) continue;
    blocks.push({ kind: "heading", text: BOOK_NAMES[code] });
    const rows: string[][] = [];
    for (const e of es) {
      e.lines.forEach((l, i) => rows.push([i === 0 ? e.date : "", `${l.credit ? "    " : ""}${books.chart.get(l.account)?.name ?? l.account}`, p(l.debit), p(l.credit)]));
      rows.push(["", e.memo, "", ""]);
    }
    blocks.push({ kind: "table", columns: [{ label: "Date", width: 0.14 }, { label: "Account and explanation", width: 0.54 }, { label: "Debit", width: 0.16, align: "right" }, { label: "Credit", width: 0.16, align: "right" }], rows });
  }
  const tb = trialBalance(post(books.entries, books.chart));
  blocks.push(
    { kind: "heading", text: "Trial balance" },
    { kind: "table", columns: [{ label: "Account", width: 0.6 }, { label: "Debit", width: 0.2, align: "right" }, { label: "Credit", width: 0.2, align: "right" }], rows: [...tb.rows.map((r) => [`${r.code} ${r.name}`, p(r.debit ?? undefined), p(r.credit ?? undefined)]), ["Total", peso(tb.totalDebit), peso(tb.totalCredit)]] },
  );
  const fs = financialStatements(books.entries, books.chart, to, books.earningsAccount);
  blocks.push(
    { kind: "heading", text: "Financial statements" },
    {
      kind: "keyValue",
      rows: [
        ["Revenue", peso(fs.incomeStatement.revenue.total)],
        ["Cost of sales", peso(fs.incomeStatement.costOfSales.total)],
        ["Operating expenses", peso(fs.incomeStatement.expenses.total)],
        ["Net income (before income tax)", peso(fs.incomeStatement.netIncome)],
        ["Total assets", peso(fs.balanceSheet.totalAssets)],
        ["Total liabilities", peso(fs.balanceSheet.totalLiabilities)],
        ["Total equity", peso(fs.balanceSheet.totalEquity)],
      ],
    },
  );
  for (const w of books.warnings) blocks.push({ kind: "paragraph", text: `Note: ${w}` });
  return { title: `Books of accounts — ${name}`, subtitle: `${from} to ${to} · posted by TaxGabay from your records`, generatedOn, blocks, watermark: "DRAFT - NOT REVIEWED" };
}
