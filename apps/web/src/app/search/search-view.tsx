"use client";

import { issuanceLabel } from "@taxgabay/content/issuances";
import { searchDocs, type SearchDoc, type SearchKind } from "@taxgabay/content/search";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { useLibrary } from "@/lib/issuances-data";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<SearchKind, string> = {
  guide: "Filing guide",
  article: "Article",
  glossary: "Glossary",
  faq: "FAQ",
  issuance: "Issuance",
  life_event: "Life event",
  calculator: "Calculator",
};

export function SearchView({ docs }: { docs: SearchDoc[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [kind, setKind] = React.useState<SearchKind | "all">("all");
  const lib = useLibrary();

  // When the library comes from the database, use its published issuances instead of the bundled list.
  const allDocs = React.useMemo(() => {
    if (lib.source !== "database") return docs;
    const dbDocs: SearchDoc[] = lib.issuances.map((i) => ({
      id: `issuance:${i.slug}`,
      kind: "issuance",
      title: `${issuanceLabel(i)} — ${i.title}`,
      href: `/issuances/${i.slug}`,
      text: i.summary_plain ?? "",
      keywords: [i.type, i.number, ...i.topics, ...i.tax_types],
    }));
    return [...docs.filter((d) => d.kind !== "issuance"), ...dbDocs];
  }, [docs, lib.source, lib.issuances]);

  const hits = q.trim() ? searchDocs(allDocs, q, kind === "all" ? {} : { kinds: [kind] }) : [];
  const counts = q.trim() ? searchDocs(allDocs, q).reduce<Record<string, number>>((m, h) => ({ ...m, [h.kind]: (m[h.kind] ?? 0) + 1 }), {}) : {};

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Search" description="Guides, articles, glossary, FAQs, issuances, life events and calculators." />
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(`/search?q=${encodeURIComponent(q)}`);
        }}
        className="space-y-1.5"
      >
        <Label htmlFor="site-q">Search TaxGabay</Label>
        <Input id="site-q" type="search" autoFocus placeholder="e.g. 2307, 8% option, estate tax" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {q.trim() && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter results">
          {(["all", ...Object.keys(KIND_LABEL)] as (SearchKind | "all")[]).map((k) => {
            const n = k === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[k] ?? 0;
            if (k !== "all" && n === 0) return null;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={cn("rounded-full border px-3 py-1 text-sm", kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
              >
                {k === "all" ? "All" : KIND_LABEL[k]} ({n})
              </button>
            );
          })}
        </div>
      )}
      {q.trim() && hits.length === 0 && <p className="text-muted-foreground">No results for “{q}”.</p>}
      <ul className="space-y-4" data-testid="search-results">
        {hits.slice(0, 50).map((h) => (
          <li key={h.id}>
            <Link href={h.href} className="font-medium text-primary underline">
              {h.title}
            </Link>{" "}
            <Badge variant="muted">{KIND_LABEL[h.kind]}</Badge>
            <p className="mt-1 text-sm text-muted-foreground">{h.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
