"use client";

import {
  BOOK_NAMES,
  closingEntries,
  financialStatements,
  post,
  trialBalance,
  worksheet,
  type BookCode,
  type Chart,
  type JournalEntry,
  type PracticeContext,
  type StatementSection,
} from "@taxgabay/accounting";
import { peso } from "@taxgabay/tax-engine";
import { StepsTable } from "@/components/steps-table";
import { cn, formatDatePH } from "@/lib/utils";

const amt = (v: string | null | undefined) => (v ? peso(v) : "");

function Panel({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="form-box overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
        <h3 className="font-display text-base font-bold">{title}</h3>
        {note && <span className="form-label">{note}</span>}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const th = "px-3 py-2 text-left font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground";
const td = "px-3 py-1.5 align-top";
const num = "px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap";

export function JournalTable({ entries, chart }: { entries: JournalEntry[]; chart: Chart }) {
  return (
    <table className="w-full min-w-[28rem] text-sm">
      <thead className="border-b border-border">
        <tr>
          <th className={th}>Date</th>
          <th className={th}>Account and explanation</th>
          <th className={cn(th, "text-right")}>Debit</th>
          <th className={cn(th, "text-right")}>Credit</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <FragmentRows key={e.id} e={e} chart={chart} />
        ))}
      </tbody>
    </table>
  );
}

function FragmentRows({ e, chart }: { e: JournalEntry; chart: Chart }) {
  return (
    <>
      {e.lines.map((l, i) => (
        <tr key={i} className={i === 0 ? "border-t border-dashed border-border" : ""}>
          <td className={cn(td, "whitespace-nowrap font-mono text-xs text-muted-foreground")}>{i === 0 ? formatDatePH(e.date, { month: "short", day: "numeric" }) : ""}</td>
          <td className={cn(td, l.credit && "pl-9")}>{chart.get(l.account)?.name}</td>
          <td className={num}>{amt(l.debit)}</td>
          <td className={num}>{amt(l.credit)}</td>
        </tr>
      ))}
      <tr>
        <td />
        <td className={cn(td, "pb-3 text-xs italic text-muted-foreground")} colSpan={3}>
          {e.memo}
        </td>
      </tr>
    </>
  );
}

export function LedgerView({ entries, chart }: { entries: JournalEntry[]; chart: Chart }) {
  const ledger = post(entries, chart);
  const active = [...ledger.values()].filter((la) => la.rows.length > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="ledger">
      {active.map((la) => (
        <Panel key={la.account.code} title={`${la.account.code} · ${la.account.name}`} note={`Balance ${peso(la.balance)}`}>
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Ref</th>
                <th className={cn(th, "text-right")}>Debit</th>
                <th className={cn(th, "text-right")}>Credit</th>
                <th className={cn(th, "text-right")}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {la.rows.map((r, i) => (
                <tr key={i} className="border-t border-dashed border-border">
                  <td className={cn(td, "whitespace-nowrap font-mono text-xs")}>{formatDatePH(r.date, { month: "short", day: "numeric" })}</td>
                  <td className={cn(td, "font-mono text-xs text-muted-foreground")}>{r.book}</td>
                  <td className={num}>{amt(r.debit)}</td>
                  <td className={num}>{amt(r.credit)}</td>
                  <td className={cn(num, "font-semibold")}>{peso(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}
    </div>
  );
}

export function TrialBalanceView({ entries, chart, title }: { entries: JournalEntry[]; chart: Chart; title: string }) {
  const tb = trialBalance(post(entries, chart));
  return (
    <Panel title={title} note={tb.balanced ? "Balanced" : "Not balanced"}>
      <table className="w-full text-sm" data-testid="trial-balance">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Account</th>
            <th className={cn(th, "text-right")}>Debit</th>
            <th className={cn(th, "text-right")}>Credit</th>
          </tr>
        </thead>
        <tbody>
          {tb.rows.map((r) => (
            <tr key={r.code} className="border-t border-dashed border-border">
              <td className={td}>
                <span className="mr-2 font-mono text-xs text-muted-foreground">{r.code}</span>
                {r.name}
              </td>
              <td className={num}>{amt(r.debit)}</td>
              <td className={num}>{amt(r.credit)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-ink font-semibold">
            <td className={td}>Total</td>
            <td className={cn(num, "underline decoration-double")}>{peso(tb.totalDebit)}</td>
            <td className={cn(num, "underline decoration-double")}>{peso(tb.totalCredit)}</td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

export function WorksheetView({ entries, chart }: { entries: JournalEntry[]; chart: Chart }) {
  const w = worksheet(entries, chart);
  const cols = ["tb", "adjustments", "adjusted", "incomeStatement", "balanceSheet"] as const;
  const heads = ["Trial balance", "Adjustments", "Adjusted TB", "Income statement", "Balance sheet"];
  return (
    <Panel title="10-column worksheet" note={`Net income ${peso(w.netIncome)}`}>
      <table className="w-full min-w-[64rem] text-xs" data-testid="worksheet">
        <thead className="border-b border-border">
          <tr>
            <th className={th} rowSpan={2}>
              Account
            </th>
            {heads.map((h) => (
              <th key={h} className={cn(th, "border-l border-border text-center")} colSpan={2}>
                {h}
              </th>
            ))}
          </tr>
          <tr>
            {cols.flatMap((c) => [
              <th key={`${c}d`} className={cn(th, "border-l border-border text-right")}>
                Dr
              </th>,
              <th key={`${c}c`} className={cn(th, "text-right")}>
                Cr
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {w.rows.map((r) => (
            <tr key={r.code} className="border-t border-dashed border-border">
              <td className={cn(td, "whitespace-nowrap")}>{r.name}</td>
              {cols.flatMap((c) => [
                <td key={`${c}d`} className={cn(num, "border-l border-border")}>
                  {amt(r[c][0])}
                </td>,
                <td key={`${c}c`} className={num}>
                  {amt(r[c][1])}
                </td>,
              ])}
            </tr>
          ))}
          <tr className="border-t-2 border-ink font-semibold">
            <td className={td}>Totals</td>
            {cols.flatMap((c) => [
              <td key={`${c}d`} className={cn(num, "border-l border-border")}>
                {peso(w.totals[c][0])}
              </td>,
              <td key={`${c}c`} className={num}>
                {peso(w.totals[c][1])}
              </td>,
            ])}
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

function SectionRows({ s }: { s: StatementSection }) {
  if (s.lines.length === 0) return null;
  return (
    <>
      <tr>
        <td className={cn(td, "pt-3 font-semibold")} colSpan={2}>
          {s.title}
        </td>
      </tr>
      {s.lines.map((l) => (
        <tr key={l.code}>
          <td className={cn(td, "pl-6")}>{l.name}</td>
          <td className={num}>{l.amount.startsWith("-") ? `(${peso(l.amount.slice(1))})` : peso(l.amount)}</td>
        </tr>
      ))}
      <tr className="border-t border-border">
        <td className={cn(td, "pl-6 text-muted-foreground")}>Total {s.title.toLowerCase()}</td>
        <td className={cn(num, "font-semibold")}>{peso(s.total)}</td>
      </tr>
    </>
  );
}

export function StatementsView({ ctx, entries }: { ctx: PracticeContext; entries: JournalEntry[] }) {
  const { set, chart } = ctx;
  return <FinancialStatementsView chart={chart} entries={entries} periodEnd={set.period.to} periodLabel={set.period.label} earningsAccount={set.earningsAccount} corporate={set.business.form === "corporation"} />;
}

/** Income statement, statement of changes in equity and balance sheet from any set of entries. */
export function FinancialStatementsView({ chart, entries, periodEnd, periodLabel, earningsAccount, corporate }: { chart: Chart; entries: JournalEntry[]; periodEnd: string; periodLabel: string; earningsAccount: string; corporate: boolean }) {
  const fs = financialStatements(entries, chart, periodEnd, earningsAccount);
  const is = fs.incomeStatement;
  const bs = fs.balanceSheet;
  const total = (label: string, v: string, strong = false) => (
    <tr className={cn("border-t", strong ? "border-t-2 border-ink font-bold" : "border-border font-semibold")}>
      <td className={td}>{label}</td>
      <td className={cn(num, strong && "underline decoration-double")}>{peso(v)}</td>
    </tr>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="statements">
      <Panel title="Income statement" note={periodLabel}>
        <table className="w-full text-sm">
          <tbody>
            <SectionRows s={is.revenue} />
            {is.costOfSales.lines.length > 0 && (
              <>
                <SectionRows s={is.costOfSales} />
                {total("Gross profit", is.grossProfit)}
              </>
            )}
            <SectionRows s={is.expenses} />
            <SectionRows s={is.otherIncome} />
            {is.incomeTax.lines.length > 0 && (
              <>
                {total("Income before tax", is.incomeBeforeTax)}
                <SectionRows s={is.incomeTax} />
              </>
            )}
            {total(Number(is.netIncome) < 0 ? "Net loss" : "Net income", is.netIncome, true)}
          </tbody>
        </table>
      </Panel>
      <div className="space-y-4">
        <Panel title={corporate ? "Statement of changes in equity" : "Statement of changes in owner's equity"}>
          <table className="w-full text-sm">
            <tbody>
              {fs.changesInEquity.opening.map((l) => (
                <tr key={l.code}>
                  <td className={td}>{l.name}, beginning</td>
                  <td className={num}>{peso(l.amount)}</td>
                </tr>
              ))}
              {fs.changesInEquity.additions.map((l) => (
                <tr key={l.code}>
                  <td className={td}>Add: additional investment ({l.name})</td>
                  <td className={num}>{peso(l.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className={td}>Add: net income</td>
                <td className={num}>{peso(fs.changesInEquity.netIncome)}</td>
              </tr>
              {fs.changesInEquity.withdrawals.map((l) => (
                <tr key={l.code}>
                  <td className={td}>Less: {l.name}</td>
                  <td className={num}>({peso(l.amount)})</td>
                </tr>
              ))}
              {total("Equity, end", fs.changesInEquity.ending, true)}
            </tbody>
          </table>
        </Panel>
        <Panel title="Balance sheet" note={`As of ${formatDatePH(periodEnd)}`}>
          <table className="w-full text-sm">
            <tbody>
              <SectionRows s={bs.currentAssets} />
              <SectionRows s={bs.noncurrentAssets} />
              {total("Total assets", bs.totalAssets, true)}
              <SectionRows s={bs.currentLiabilities} />
              <SectionRows s={bs.noncurrentLiabilities} />
              <tr>
                <td className={cn(td, "pt-3 font-semibold")} colSpan={2}>
                  Equity
                </td>
              </tr>
              {bs.equity.map((l) => (
                <tr key={l.code}>
                  <td className={cn(td, "pl-6")}>{l.name}</td>
                  <td className={num}>{peso(l.amount)}</td>
                </tr>
              ))}
              {total("Total liabilities and equity", bs.totalLiabilitiesAndEquity, true)}
            </tbody>
          </table>
          {!bs.balanced && <p className="border-t border-border px-4 py-2 text-sm text-destructive">Assets and liabilities plus equity are not equal yet — some transactions are still unrecorded.</p>}
        </Panel>
      </div>
    </div>
  );
}

export function ClosingView({ ctx, entries }: { ctx: PracticeContext; entries: JournalEntry[] }) {
  const closing = closingEntries(entries, ctx.chart, ctx.set.period.to, ctx.set.incomeSummaryAccount, ctx.set.earningsAccount);
  return (
    <div className="space-y-4">
      <Panel title="Closing entries" note={formatDatePH(ctx.set.period.to)}>
        <JournalTable entries={closing} chart={ctx.chart} />
      </Panel>
      <TrialBalanceView entries={[...entries, ...closing]} chart={ctx.chart} title="Post-closing trial balance" />
    </div>
  );
}

export function BooksView({ ctx, entries }: { ctx: PracticeContext; entries: JournalEntry[] }) {
  const byBook = new Map<BookCode, JournalEntry[]>();
  for (const e of entries) if (e.kind !== "opening") byBook.set(e.book, [...(byBook.get(e.book) ?? []), e]);
  return (
    <div className="space-y-4" data-testid="books">
      {ctx.set.books.map((b) => (
        <Panel key={b} title={BOOK_NAMES[b]} note={`${byBook.get(b)?.length ?? 0} entries`}>
          {byBook.get(b)?.length ? <JournalTable entries={byBook.get(b)!} chart={ctx.chart} /> : <p className="px-4 py-3 text-sm text-muted-foreground">No entries recorded in this book yet.</p>}
        </Panel>
      ))}
    </div>
  );
}

export function ReturnsView({ ctx }: { ctx: PracticeContext }) {
  const returns = ctx.set.returns(ctx);
  return (
    <div className="space-y-6" data-testid="returns">
      {returns.map((r) => (
        <section key={r.form + r.period} className="space-y-3">
          <div className="form-box relative overflow-hidden p-5 pl-6">
            <span className="absolute inset-y-0 left-0 w-1.5 bg-sun" aria-hidden="true" />
            <p className="form-label">
              BIR Form <span className="code text-foreground">{r.form}</span> · {r.period}
            </p>
            <h3 className="mt-1 font-display text-xl font-bold">{r.title}</h3>
            <p className="mt-2 max-w-[70ch] leading-relaxed">{r.summary}</p>
          </div>
          <StepsTable steps={r.steps} caption={`Computed from the books`} />
          {r.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
