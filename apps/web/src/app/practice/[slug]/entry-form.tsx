"use client";

import { BOOK_NAMES, checkEntry, type Account, type Chart, type EntryLine, type Feedback, type PracticeTransaction, type Track } from "@taxgabay/accounting";
import { peso } from "@taxgabay/tax-engine";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDatePH } from "@/lib/utils";

const DOC_LABEL: Record<string, string> = {
  sales_invoice: "Sales invoice",
  official_receipt: "Official receipt",
  cash_voucher: "Cash voucher",
  supplier_invoice: "Supplier's invoice",
  payroll_register: "Payroll register",
  bank_statement: "Bank statement",
  deposit_slip: "Deposit slip",
  form_2307: "BIR Form 2307",
  memo: "Memo",
};

const GROUP_LABEL: Record<Account["type"], string> = { asset: "Assets", liability: "Liabilities", equity: "Equity", revenue: "Revenue", expense: "Expenses" };

function blank(): EntryLine[] {
  return [
    { account: "", debit: "", credit: "" },
    { account: "", debit: "", credit: "" },
  ];
}

export function AccountSelect({ chart, value, onChange, id, label }: { chart: Chart; value: string; onChange: (v: string) => void; id: string; label: string }) {
  const groups = new Map<Account["type"], Account[]>();
  for (const a of chart.values()) groups.set(a.type, [...(groups.get(a.type) ?? []), a]);
  return (
    <select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full min-w-0 rounded-sm border border-input bg-card px-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <option value="">Choose account…</option>
      {[...groups].map(([type, list]) => (
        <optgroup key={type} label={GROUP_LABEL[type]}>
          {list.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} · {a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function TransactionCard({
  tx,
  index,
  chart,
  track,
  status,
  attempt,
  onAttempt,
  onCorrect,
  onReveal,
}: {
  tx: PracticeTransaction;
  index: string;
  chart: Chart;
  track: Track;
  status: "open" | "correct" | "revealed";
  attempt?: EntryLine[];
  onAttempt: (lines: EntryLine[]) => void;
  onCorrect: () => void;
  onReveal: () => void;
}) {
  const [lines, setLines] = React.useState<EntryLine[]>(() => (attempt?.length ? attempt : blank()));
  const [feedback, setFeedback] = React.useState<Feedback[] | null>(null);
  const [showAnswer, setShowAnswer] = React.useState(status === "revealed");
  const done = status !== "open";

  const update = (i: number, patch: Partial<EntryLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function check() {
    const r = checkEntry(lines, { lines: tx.answer }, chart);
    setFeedback(r.feedback);
    onAttempt(lines);
    if (r.correct) onCorrect();
  }

  return (
    <article className={cn("rounded-md border bg-card", done ? "border-success/40" : "border-border")} data-testid="practice-tx" id={`tx-${tx.id}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
        <span className="font-mono text-xs font-bold text-muted-foreground">{index}</span>
        <time dateTime={tx.date} className="font-mono text-xs text-muted-foreground">
          {formatDatePH(tx.date)}
        </time>
        <span className="form-label">{BOOK_NAMES[tx.book]}</span>
        <span className="ml-auto">
          {status === "correct" && <Badge variant="success">Correct</Badge>}
          {status === "revealed" && <Badge variant="muted">Answer shown</Badge>}
        </span>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-3">
          <p className="leading-relaxed">{tx.narrative}</p>
          {tx.document && (
            <div className="relative rounded-sm border border-dashed border-input bg-background p-3 font-mono text-xs leading-relaxed">
              <div className="flex flex-wrap justify-between gap-2 font-bold uppercase tracking-wider text-muted-foreground">
                <span>{DOC_LABEL[tx.document.type]}</span>
                {tx.document.number && <span>{tx.document.number}</span>}
              </div>
              {tx.document.party && <div className="mt-1 text-foreground">{tx.document.party}</div>}
              <div className="mt-1 text-foreground">{tx.document.details}</div>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {!showAnswer && (
            <>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="form-label text-left">
                      <th className="pb-1.5 font-semibold">Account</th>
                      <th className="w-28 pb-1.5 text-right font-semibold">Debit</th>
                      <th className="w-28 pb-1.5 text-right font-semibold">Credit</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-2">
                          <AccountSelect chart={chart} id={`${tx.id}-acct-${i}`} label={`Line ${i + 1} account`} value={l.account} onChange={(v) => update(i, { account: v })} />
                        </td>
                        <td className="py-1 pr-2">
                          <input aria-label={`Line ${i + 1} debit`} inputMode="decimal" value={l.debit ?? ""} onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} disabled={done} className="h-9 w-full rounded-sm border border-input bg-card px-2 text-right font-mono text-sm" />
                        </td>
                        <td className="py-1 pr-2">
                          <input aria-label={`Line ${i + 1} credit`} inputMode="decimal" value={l.credit ?? ""} onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} disabled={done} className="h-9 w-full rounded-sm border border-input bg-card px-2 text-right font-mono text-sm" />
                        </td>
                        <td className="py-1 text-right">
                          {lines.length > 2 && !done && (
                            <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`} className="h-9 w-8 text-muted-foreground hover:text-destructive">
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!done && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={check}>
                    Check
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, { account: "", debit: "", credit: "" }])}>
                    Add line
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAnswer(true);
                      onReveal();
                    }}
                  >
                    Show answer
                  </Button>
                </div>
              )}
              {feedback && (
                <div role="status" className={cn("rounded-sm border p-3 text-sm", feedback.length === 0 ? "border-success/50 bg-success/10 text-success" : "border-sun bg-sun-soft text-sun-foreground dark:text-sun")} data-testid="practice-feedback">
                  {feedback.length === 0 ? (
                    <p className="font-semibold">Correct. Posted to the ledger.</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-4">
                      {feedback.map((f, i) => (
                        <li key={i}>{f.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {(showAnswer || status === "correct") && (
            <div className="space-y-3" data-testid="practice-answer">
              {showAnswer && (
                <table className="w-full text-sm">
                  <tbody>
                    {tx.answer.map((l, i) => (
                      <tr key={i} className="border-b border-dashed border-border last:border-0">
                        <td className={cn("py-1.5", l.credit && "pl-6")}>{chart.get(l.account)?.name}</td>
                        <td className="w-28 py-1.5 text-right font-mono">{l.debit ? peso(l.debit) : ""}</td>
                        <td className="w-28 py-1.5 text-right font-mono">{l.credit ? peso(l.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="form-label mr-1">Why</span>
                {tx.explanation}
              </p>
              {track === "owner" && tx.ownerTip && (
                <p className="border-l-2 border-sun pl-3 text-sm leading-relaxed">
                  <span className="form-label mr-1">Owner tip</span>
                  {tx.ownerTip}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
