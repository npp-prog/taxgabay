"use client";

import { BOOK_NAMES, type BookCode } from "@taxgabay/accounting";
import { buildBooks, fiscalQuarterLabel, fiscalQuarterRange, fiscalYearRange, type ClientInfo, type ClientRecord, type QuarterRef } from "@taxgabay/filing";
import { taxableYearEnd } from "@/lib/workspace-core";
import * as React from "react";
import { PdfButton } from "@/components/pdf-button";
import { booksPdf } from "@/lib/books-pdf";
import { cn, todayPH } from "@/lib/utils";
import { FinancialStatementsView, JournalTable, LedgerView, TrialBalanceView } from "../practice/[slug]/reports";

type View = "journal" | "ledger" | "tb" | "fs";

/** Books of accounts, ledger, trial balance and statements posted from the records. */
export function BooksSection({ client, records, period }: { client: ClientInfo; records: readonly ClientRecord[]; period: QuarterRef }) {
  const [scope, setScope] = React.useState<"quarter" | "ytd">("quarter");
  const [view, setView] = React.useState<View>("journal");
  const fy = taxableYearEnd(client.profile);
  const q = fiscalQuarterRange(fy, period);
  const from = scope === "quarter" ? q.start : fiscalYearRange(fy, period.year).start;
  const to = q.end;
  const books = buildBooks({ client, records, from, to });
  const label = scope === "quarter" ? fiscalQuarterLabel(fy, period) : `${from} to ${q.end}`;
  const corporate = ["corporation", "opc", "partnership"].includes(client.profile.taxpayer_type);
  const tabs: [View, string][] = [
    ["journal", "Books"],
    ["ledger", "Ledger"],
    ["tb", "Trial balance"],
    ["fs", "Statements"],
  ];
  return (
    <section className="space-y-4" aria-labelledby="books-h" data-testid="books-section">
      <div className="form-box flex flex-wrap items-center gap-3 p-5">
        <div className="mr-auto">
          <h2 id="books-h" className="text-lg font-semibold">
            Books and financial statements
          </h2>
          <p className="text-sm text-muted-foreground">Posted automatically from your records ({label}).</p>
        </div>
        <div role="radiogroup" aria-label="Period" className="flex gap-1 rounded-full border border-border p-1 text-sm">
          {(
            [
              ["quarter", "This quarter"],
              ["ytd", "Year to date"],
            ] as const
          ).map(([k, t]) => (
            <button key={k} type="button" role="radio" aria-checked={scope === k} onClick={() => setScope(k)} className={cn("rounded-full px-3 py-1", scope === k ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>
              {t}
            </button>
          ))}
        </div>
        <PdfButton filename={`taxgabay-books-${from}-${q.end}.pdf`} label="Books (PDF)" build={() => booksPdf(client.name || "Taxpayer", books, from, q.end, todayPH())} />
      </div>
      <div role="tablist" className="flex gap-1 border-b border-border">
        {tabs.map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", view === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
      </div>
      {books.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records in this period yet.</p>
      ) : (
        <>
          {view === "journal" &&
            (["CRB", "CDB", "GJ"] as BookCode[]).map((code) => {
              const es = books.entries.filter((e) => e.book === code);
              if (!es.length) return null;
              return (
                <div key={code} className="form-box overflow-hidden">
                  <h3 className="border-b border-border px-4 py-2.5 font-semibold">{BOOK_NAMES[code]}</h3>
                  <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
                    <JournalTable entries={es} chart={books.chart} />
                  </div>
                </div>
              );
            })}
          {view === "ledger" && <LedgerView entries={books.entries} chart={books.chart} />}
          {view === "tb" && <TrialBalanceView entries={books.entries} chart={books.chart} title="Trial balance" />}
          {view === "fs" && <FinancialStatementsView chart={books.chart} entries={books.entries} periodEnd={q.end} periodLabel={label} earningsAccount={books.earningsAccount} corporate={corporate} />}
        </>
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {books.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </section>
  );
}
