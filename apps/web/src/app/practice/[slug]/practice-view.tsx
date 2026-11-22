"use client";

import { getPracticeSet, learnerEntries, practiceContext, type PracticeTransaction, type Track } from "@taxgabay/accounting";
import Link from "next/link";
import * as React from "react";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { PdfButton } from "@/components/pdf-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePracticeProgress, useTrack } from "@/lib/practice-progress";
import { blankFormsPdf, workedExamplePdf } from "@/lib/practice-pdf";
import { cn, formatDatePH, todayPH } from "@/lib/utils";
import { TransactionCard } from "./entry-form";
import { BooksView, ClosingView, JournalTable, LedgerView, ReturnsView, StatementsView, TrialBalanceView, WorksheetView } from "./reports";

const noopSubscribe = () => () => {};

type Tab = "overview" | "record" | "books" | "ledger" | "tb" | "worksheet" | "statements" | "closing" | "returns" | "example";

const TABS: Record<Track, [Tab, string][]> = {
  owner: [
    ["overview", "Overview"],
    ["record", "Record transactions"],
    ["books", "Books"],
    ["ledger", "Ledger"],
    ["statements", "Statements"],
    ["returns", "Tax returns"],
    ["example", "Worked example"],
  ],
  student: [
    ["overview", "Overview"],
    ["record", "Journalize"],
    ["ledger", "Ledger"],
    ["tb", "Trial balance"],
    ["worksheet", "Worksheet"],
    ["statements", "Statements"],
    ["closing", "Closing"],
    ["example", "Worked example"],
    ["returns", "Tax returns"],
  ],
};

export function PracticeView({ slug }: { slug: string }) {
  const set = getPracticeSet(slug)!;
  const ctx = React.useMemo(() => practiceContext(set), [set]);
  const [track, setTrack] = useTrack();
  const { progress, saveAttempt, markCorrect, reveal, reset } = usePracticeProgress(slug);
  const [tab, setTab] = React.useState<Tab>("overview");
  const [useKey, setUseKey] = React.useState(false);
  // Remount cards once on the client so saved attempts from localStorage fill the inputs.
  const hydrated = React.useSyncExternalStore(noopSubscribe, () => true, () => false);

  const all: PracticeTransaction[] = [...set.transactions, ...set.adjustments];
  const done = new Set([...progress.correct, ...progress.revealed]);
  const doneCount = all.filter((t) => done.has(t.id)).length;
  const complete = doneCount === all.length;
  const reportEntries = useKey ? ctx.entries : learnerEntries(set, done);
  const tabs = TABS[track];
  const active = tabs.some(([k]) => k === tab) ? tab : "overview";

  const card = (t: PracticeTransaction, index: string) => (
    <TransactionCard
      key={`${t.id}-${hydrated ? "c" : "s"}`}
      tx={t}
      index={index}
      chart={ctx.chart}
      track={track}
      status={progress.correct.includes(t.id) ? "correct" : progress.revealed.includes(t.id) ? "revealed" : "open"}
      attempt={progress.attempts[t.id]}
      onAttempt={(l) => saveAttempt(t.id, l)}
      onCorrect={() => markCorrect(t.id)}
      onReveal={() => reveal(t.id)}
    />
  );

  const sourceToggle = (
    <div className="flex flex-wrap items-center gap-3 rounded-sm border border-dashed border-input bg-card px-3 py-2 text-sm">
      <span className="form-label">Built from</span>
      <div role="radiogroup" aria-label="Source of the reports" className="flex gap-1">
        {[
          [false, "Your entries"],
          [true, "Answer key"],
        ].map(([v, label]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={useKey === v} onClick={() => setUseKey(v as boolean)} className={cn("rounded-sm px-2.5 py-1", useKey === v ? "bg-ink text-background" : "hover:bg-muted")}>
            {label as string}
          </button>
        ))}
      </div>
      {!useKey && !complete && (
        <span className="text-muted-foreground">
          {all.length - doneCount} of {all.length} entries still to record — totals are incomplete.
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Practice set · ${set.period.label}`} title={set.title} description={set.summary} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[14rem]">
          <div className="flex justify-between text-sm">
            <span className="form-label">Progress</span>
            <span className="font-mono" data-testid="practice-progress">
              {doneCount}/{all.length}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-sm bg-muted" role="progressbar" aria-label="Entries recorded" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={doneCount}>
            <div className="h-full bg-sun transition-all" style={{ width: `${(doneCount / all.length) * 100}%` }} />
          </div>
        </div>
        <div role="radiogroup" aria-label="Track" className="flex gap-1 rounded-sm border border-border p-1 text-sm">
          {(
            [
              ["owner", "Business owner"],
              ["student", "Accounting student"],
            ] as [Track, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={track === k} onClick={() => setTrack(k)} className={cn("rounded-sm px-2.5 py-1", track === k ? "bg-ink text-background" : "hover:bg-muted")}>
              {label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (window.confirm("Clear all your entries for this practice set?")) reset();
          }}
        >
          Start over
        </Button>
      </div>

      <nav aria-label="Practice sections" className="-mx-4 overflow-x-auto px-4">
        <div role="tablist" className="flex min-w-max gap-1 border-b border-border">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active === k}
              onClick={() => setTab(k)}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", active === k ? "border-sun text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div role="tabpanel" className="space-y-4">
        {active === "overview" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <section className="form-box p-5">
                <p className="form-label">The business</p>
                <h2 className="mt-1 font-display text-xl font-bold">{set.business.name}</h2>
                <p className="mt-2 leading-relaxed">{set.business.description}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed border-border pt-3 text-sm">
                  <div>
                    <dt className="form-label">Owner</dt>
                    <dd>{set.business.owner}</dd>
                  </div>
                  <div>
                    <dt className="form-label">Period</dt>
                    <dd>
                      {formatDatePH(set.period.from)} – {formatDatePH(set.period.to)}
                    </dd>
                  </div>
                  <div>
                    <dt className="form-label">Tax type</dt>
                    <dd>{set.business.profile.vat_status === "vat" ? "VAT-registered" : "Non-VAT"}</dd>
                  </div>
                  <div>
                    <dt className="form-label">Books required</dt>
                    <dd>{set.books.join(", ")}</dd>
                  </div>
                </dl>
              </section>
              <section className="form-box p-5">
                <p className="form-label">Opening balances · {formatDatePH(set.opening.date)}</p>
                <div className="-mx-5 mt-2 overflow-x-auto">
                  <JournalTable entries={ctx.entries.filter((e) => e.kind === "opening")} chart={ctx.chart} />
                </div>
              </section>
            </div>
            <div className="space-y-4">
              <section className="form-box p-5">
                <p className="form-label">You will learn to</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                  {set.learningGoals.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </section>
              <section className="border-l-2 border-sun pl-4 text-sm leading-relaxed">
                {track === "owner" ? (
                  <p>
                    <strong>Business owner track.</strong> Record each receipt and invoice the way you would in your BIR-registered books, then see the books, statements and tax returns they produce. Tips explain what the BIR expects.
                  </p>
                ) : (
                  <p>
                    <strong>Accounting student track.</strong> Journalize, post, prepare the trial balance and 10-column worksheet, then the statements and closing entries — the full accounting cycle.
                  </p>
                )}
                <Button size="sm" className="mt-3" onClick={() => setTab("record")}>
                  {doneCount === 0 ? "Start recording" : "Continue"}
                </Button>
              </section>
            </div>
          </div>
        )}

        {active === "record" && (
          <div className="space-y-4">
            <p className="max-w-[75ch] text-sm leading-relaxed text-muted-foreground">
              Pick the accounts and type the amounts, then press <strong>Check</strong>. Amounts are in pesos; no commas needed.
            </p>
            {set.transactions.map((t, i) => card(t, String(i + 1).padStart(2, "0")))}
            <h2 className="pt-4 font-display text-xl font-bold">Adjusting entries · {formatDatePH(set.period.to)}</h2>
            {set.adjustments.map((t, i) => card(t, `A${i + 1}`))}
          </div>
        )}

        {active === "books" && (
          <>
            {sourceToggle}
            <BooksView ctx={ctx} entries={reportEntries} />
          </>
        )}
        {active === "ledger" && (
          <>
            {sourceToggle}
            <LedgerView entries={reportEntries} chart={ctx.chart} />
          </>
        )}
        {active === "tb" && (
          <>
            {sourceToggle}
            <TrialBalanceView entries={reportEntries} chart={ctx.chart} title="Adjusted trial balance" />
          </>
        )}
        {active === "worksheet" && (
          <>
            {sourceToggle}
            <WorksheetView entries={reportEntries} chart={ctx.chart} />
          </>
        )}
        {active === "statements" && (
          <>
            {sourceToggle}
            <StatementsView ctx={ctx} entries={reportEntries} />
          </>
        )}
        {active === "closing" && (
          <>
            {sourceToggle}
            <ClosingView ctx={ctx} entries={reportEntries} />
          </>
        )}
        {active === "returns" && (
          <>
            <p className="max-w-[75ch] text-sm leading-relaxed text-muted-foreground">These returns are computed from the complete answer-key books, using the same calculators as the rest of TaxGabay.</p>
            <ReturnsView ctx={ctx} />
          </>
        )}
        {active === "example" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <PdfButton filename={`${set.slug}-worked-solution.pdf`} label="Worked solution (PDF)" build={() => workedExamplePdf(ctx, todayPH())} />
              <PdfButton filename="blank-general-journal.pdf" label="Blank journal" build={() => blankFormsPdf("journal", todayPH())} />
              <PdfButton filename="blank-ledger.pdf" label="Blank ledger" build={() => blankFormsPdf("ledger", todayPH())} />
              <PdfButton filename="blank-cash-book.pdf" label="Blank cash book" build={() => blankFormsPdf("cash", todayPH())} />
            </div>
            <section className="form-box overflow-hidden">
              <header className="border-b border-border px-4 py-2.5">
                <h3 className="font-display text-base font-bold">Complete journal — answer key</h3>
              </header>
              <div className="overflow-x-auto">
                <JournalTable entries={ctx.entries} chart={ctx.chart} />
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {set.needs_verification && <Badge variant="muted">Awaiting CPA review</Badge>}
        <Link href="/practice" className="text-primary underline">
          All practice sets
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/business-guide" className="text-primary underline">
          Business guide
        </Link>
      </div>
      <Disclaimer lastVerified={null} />
    </div>
  );
}
