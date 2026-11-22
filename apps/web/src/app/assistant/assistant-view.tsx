"use client";

import Link from "next/link";
import * as React from "react";
import type { AssistantResult } from "@/lib/assistant-core";
import { DISCLAIMER_TEXT } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";

const MAX = 500;
const EXAMPLES = ["Who can use the 8% income tax option?", "When is the 1701Q due?", "What is the VAT threshold?", "What is a 2307?"];

interface Turn {
  question: string;
  result: AssistantResult | null;
}

const REFUSAL_TEXT: Record<string, string> = {
  no_sources: "I can only answer from content TaxGabay's CPA has checked, and none of it covers this question yet.",
  not_covered: "The content I'm allowed to use doesn't answer this question.",
  uncited: "I couldn't back an answer with a source, so I won't give one.",
  declined: "I can't help with this question.",
};

function Answer({ result, index }: { result: AssistantResult; index: number }) {
  if (result.status === "unavailable") {
    return (
      <p>
        The assistant isn&apos;t switched on for this site yet. Try{" "}
        <Link href="/search" className="text-primary underline">
          searching TaxGabay
        </Link>{" "}
        instead.
      </p>
    );
  }
  if (result.status === "error") {
    return (
      <p role="alert" className="text-destructive">
        {result.message}
      </p>
    );
  }
  if (result.status === "refused") {
    return (
      <div className="space-y-2" data-testid="assistant-refusal">
        <p>{REFUSAL_TEXT[result.reason]}</p>
        {result.suggestions.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">These pages may help (read them with care if marked unverified):</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.suggestions.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="text-primary underline">
                    {s.title}
                  </Link>{" "}
                  {!s.verified && <Badge variant="warning">Unverified</Badge>}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-sm text-muted-foreground">For your specific situation, ask a CPA or your RDO.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid="assistant-answer">
      {result.usedUnverified && (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm text-warning-foreground">
          This answer uses content that TaxGabay&apos;s CPA has not verified yet. Check it against the sources.
        </p>
      )}
      <p className="whitespace-pre-line leading-relaxed">
        {result.segments.map((s, i) => (
          <React.Fragment key={i}>
            {s.text}
            {s.sources.map((n) => (
              <a key={n} href={`#src-${index}-${n}`} className="ml-0.5 align-super text-xs font-semibold text-primary" aria-label={`Source ${n}`}>
                [{n}]
              </a>
            ))}
          </React.Fragment>
        ))}
      </p>
      <div>
        <h3 className="text-sm font-semibold">Sources</h3>
        <ol className="mt-1 space-y-2 text-sm">
          {result.sources.map((s) => (
            <li key={s.n} id={`src-${index}-${s.n}`}>
              <span className="font-mono">[{s.n}]</span>{" "}
              <Link href={s.href} className="text-primary underline">
                {s.title}
              </Link>{" "}
              {s.verified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
              {s.quotes.slice(0, 2).map((q) => (
                <blockquote key={q} className="mt-1 border-l-2 border-border pl-2 text-muted-foreground">
                  “{q}”
                </blockquote>
              ))}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function AssistantView() {
  const [q, setQ] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setQ("");
    setTurns((t) => [{ question: text, result: null }, ...t]);
    let result: AssistantResult;
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) });
      result = (await res.json()) as AssistantResult;
    } catch {
      result = { status: "error", message: "Could not reach the assistant. Check your connection and try again." };
    }
    setTurns((t) => [{ question: text, result }, ...t.slice(1)]);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Ask TaxGabay"
        description="Ask about BIR registration, returns, deadlines and rates. Answers come only from TaxGabay's own guides and rule tables, with the source for every point. If they don't cover your question, the assistant says so."
      />
      <Card>
        <CardContent className="space-y-3 pt-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(q);
            }}
            className="space-y-2"
          >
            <Label htmlFor="ask-q">Your question</Label>
            <textarea
              id="ask-q"
              rows={3}
              maxLength={MAX}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(q);
                }
              }}
              placeholder="e.g. Who can use the 8% income tax option?"
              className="w-full rounded-md border border-input bg-background p-3 text-base sm:text-sm"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {q.length}/{MAX} · Don&apos;t include your TIN or other personal details.
              </span>
              <Button type="submit" disabled={busy || q.trim().length < 3}>
                {busy ? "Looking it up…" : "Ask"}
              </Button>
            </div>
          </form>
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => void ask(e)} className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted">
                  {e}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ol className="space-y-4" aria-live="polite">
        {turns.map((t, i) => (
          <li key={turns.length - i}>
            <Card>
              <CardContent className="space-y-3 pt-5">
                <p className="font-medium">{t.question}</p>
                {t.result ? <Answer result={t.result} index={turns.length - i} /> : <p className="text-muted-foreground">Looking it up…</p>}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{DISCLAIMER_TEXT} The assistant is not a CPA and does not file anything for you.</p>
    </div>
  );
}
