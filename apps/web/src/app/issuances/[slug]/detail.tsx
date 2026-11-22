"use client";

import { TAX_TYPE_LABELS, issuanceLabel, relatedIssuances, type RelatedIssuance } from "@taxgabay/content/issuances";
import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLibrary } from "@/lib/issuances-data";
import { formatDatePH } from "@/lib/utils";

function shortLabel(r: RelatedIssuance): string {
  return r.issuance ? issuanceLabel(r.issuance) : r.slug;
}

/** Node-link diagram: issuances this one points to on the right, ones pointing to it on the left. */
function RelationGraph({ center, related }: { center: string; related: RelatedIssuance[] }) {
  const left = related.filter((r) => r.direction === "in");
  const right = related.filter((r) => r.direction === "out");
  const rows = Math.max(left.length, right.length, 1);
  const rowH = 56;
  const h = rows * rowH + 16;
  const W = 640;
  const nodeW = 150;
  const cx = W / 2;
  const cy = h / 2;
  const y = (i: number, n: number) => cy + (i - (n - 1) / 2) * rowH;
  const node = (x: number, yy: number, text: string, strong = false, key?: string) => (
    <g key={key}>
      <rect x={x - nodeW / 2} y={yy - 16} width={nodeW} height={32} rx={8} fill={strong ? "var(--color-primary)" : "var(--color-card)"} stroke="var(--color-border)" />
      <text x={x} y={yy + 5} textAnchor="middle" fontSize={13} fill={strong ? "var(--color-primary-foreground)" : "var(--color-foreground)"} fontFamily="Poppins, ui-sans-serif, sans-serif">
        {text}
      </text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="h-auto w-full max-w-2xl" role="img" aria-label={`Related issuances of ${center}`}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-muted-foreground)" />
        </marker>
      </defs>
      {left.map((r, i) => {
        const yy = y(i, left.length);
        const endY = cy + (left.length > 1 ? (i - (left.length - 1) / 2) * (20 / (left.length - 1)) : 0);
        return (
          <g key={`l${r.slug}${r.relation}`}>
            <line x1={90 + nodeW / 2} y1={yy} x2={cx - nodeW / 2 - 4} y2={endY} stroke="var(--color-muted-foreground)" markerEnd="url(#arrow)" />
            <text x={90 + nodeW / 2 + 6} y={yy - 6} textAnchor="start" fontSize={11} fill="var(--color-muted-foreground)">
              {r.relation}
            </text>
            {node(90, yy, shortLabel(r))}
          </g>
        );
      })}
      {right.map((r, i) => {
        const yy = y(i, right.length);
        const startY = cy + (right.length > 1 ? (i - (right.length - 1) / 2) * (20 / (right.length - 1)) : 0);
        return (
          <g key={`r${r.slug}${r.relation}`}>
            <line x1={cx + nodeW / 2} y1={startY} x2={W - 90 - nodeW / 2 - 4} y2={yy} stroke="var(--color-muted-foreground)" markerEnd="url(#arrow)" />
            <text x={W - 90 - nodeW / 2 - 6} y={yy - 6} textAnchor="end" fontSize={11} fill="var(--color-muted-foreground)">
              {r.relation}
            </text>
            {node(W - 90, yy, shortLabel(r))}
          </g>
        );
      })}
      {node(cx, cy, center, true)}
    </svg>
  );
}

export function IssuanceDetail({ slug }: { slug: string }) {
  const lib = useLibrary();
  if (lib.loading) return <p>Loading…</p>;
  const i = lib.issuances.find((x) => x.slug === slug);
  if (!i) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Issuance not found</h1>
        <p>It may not be published yet.</p>
        <Link href="/issuances" className={buttonVariants({ variant: "outline" })}>
          Back to the library
        </Link>
      </div>
    );
  }
  const related = relatedIssuances(i.slug, lib.links, lib.issuances);
  const label = issuanceLabel(i);

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/issuances" className="underline">
          Issuances
        </Link>{" "}
        / {label}
      </nav>
      <header className="space-y-2">
        <p className="font-mono text-sm font-semibold text-primary">{label}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{i.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant={i.status === "active" ? "success" : "warning"}>{i.status}</Badge>
          {i.tax_types.map((t) => (
            <Badge key={t} variant="outline">
              {TAX_TYPE_LABELS[t] ?? t}
            </Badge>
          ))}
        </div>
      </header>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Date issued</dt>
          <dd>{i.date_issued ? formatDatePH(i.date_issued) : "To be confirmed"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Effectivity</dt>
          <dd>{i.effectivity_date ? formatDatePH(i.effectivity_date) : "To be confirmed"}</dd>
        </div>
      </dl>
      <Card>
        <CardHeader>
          <CardTitle>In plain language</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{i.summary_plain ?? "Summary not yet written."}</p>
          {i.topics.length > 0 && <p className="mt-3 text-sm text-muted-foreground">Topics: {i.topics.join(", ")}</p>}
        </CardContent>
      </Card>
      {i.source_url && (
        <a href={i.source_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
          Read the official text ↗
        </a>
      )}
      <section aria-labelledby="related-h" className="space-y-3">
        <h2 id="related-h" className="text-xl font-semibold">
          Related issuances
        </h2>
        {related.length === 0 ? (
          <p className="text-muted-foreground">No related issuances recorded yet.</p>
        ) : (
          <>
            <RelationGraph center={label} related={related} />
            <ul className="space-y-1" data-testid="related-list">
              {related.map((r) => (
                <li key={`${r.direction}${r.slug}${r.relation}`}>
                  {r.label}{" "}
                  {r.issuance ? (
                    <Link href={`/issuances/${r.slug}`} className="text-primary underline">
                      {shortLabel(r)} — {r.issuance.title}
                    </Link>
                  ) : (
                    <span>{r.slug} (not in the library yet)</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <Disclaimer lastVerified={null} />
    </article>
  );
}
