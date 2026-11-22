"use client";

import Link from "next/link";
import * as React from "react";
import type { AssistantResult } from "@/lib/assistant-core";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { useLocale } from "@/lib/i18n";

const MAX = 500;

interface Turn {
  question: string;
  result: AssistantResult | null;
}

function Answer({ result, index }: { result: AssistantResult; index: number }) {
  const { t } = useLocale();
  const a = t.assistant;
  if (result.status === "unavailable") {
    return (
      <p>
        <Link href="/search" className="text-primary underline">
          {a.unavailable}
        </Link>
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
        <p>{a.refusal[result.reason]}</p>
        {result.suggestions.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">{a.helpful}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.suggestions.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="text-primary underline">
                    {s.title}
                  </Link>{" "}
                  {!s.verified && <Badge variant="warning">{a.unverified}</Badge>}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-sm text-muted-foreground">{a.cpa}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid="assistant-answer">
      {result.usedUnverified && (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm text-warning-foreground">
          {a.unverifiedWarning}
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
        <h3 className="text-sm font-semibold">{a.sources}</h3>
        <ol className="mt-1 space-y-2 text-sm">
          {result.sources.map((s) => (
            <li key={s.n} id={`src-${index}-${s.n}`}>
              <span className="font-mono">[{s.n}]</span>{" "}
              <Link href={s.href} className="text-primary underline">
                {s.title}
              </Link>{" "}
              {s.verified ? <Badge variant="success">{a.verified}</Badge> : <Badge variant="warning">{a.unverified}</Badge>}
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
  const { t } = useLocale();
  const a = t.assistant;
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
      result = { status: "error", message: a.networkError };
    }
    setTurns((t) => [{ question: text, result }, ...t.slice(1)]);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={a.title} description={a.description} />
      <Card>
        <CardContent className="space-y-3 pt-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(q);
            }}
            className="space-y-2"
          >
            <Label htmlFor="ask-q">{a.label}</Label>
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
              placeholder={a.placeholder}
              className="w-full rounded-md border border-input bg-background p-3 text-base sm:text-sm"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {q.length}/{MAX} · {a.privacy}
              </span>
              <Button type="submit" disabled={busy || q.trim().length < 3}>
                {busy ? a.busy : a.ask}
              </Button>
            </div>
          </form>
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {a.examples.map((e) => (
                <button key={e} type="button" onClick={() => void ask(e)} className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted">
                  {e}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ol className="space-y-4" aria-live="polite">
        {turns.map((turn, i) => (
          <li key={turns.length - i}>
            <Card>
              <CardContent className="space-y-3 pt-5">
                <p className="font-medium">{turn.question}</p>
                {turn.result ? <Answer result={turn.result} index={turns.length - i} /> : <p className="text-muted-foreground">{a.busy}</p>}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">
        {t.disclaimer.text} {a.notCpa}
      </p>
    </div>
  );
}
