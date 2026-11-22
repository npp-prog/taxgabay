"use client";

import { glossary, glossarySlug } from "@taxgabay/content/glossary";
import Link from "next/link";
import * as React from "react";
import { Input, Label } from "@/components/ui/input";

export function GlossaryList() {
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? glossary.filter((g) => [g.term, g.definition, ...(g.aka ?? [])].some((s) => s.toLowerCase().includes(needle)))
    : glossary;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="glossary-filter">Filter terms</Label>
        <Input id="glossary-filter" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. VAT, resibo, 2307" />
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {shown.length} of {glossary.length} terms
      </p>
      <dl className="divide-y divide-border">
        {shown.map((g) => (
          <div key={g.term} id={glossarySlug(g.term)} className="scroll-mt-20 py-4" data-testid="glossary-term">
            <dt className="font-semibold">{g.term}</dt>
            {g.aka && g.aka.length > 0 && <dd className="text-sm text-muted-foreground">Also called: {g.aka.join(", ")}</dd>}
            <dd className="mt-1">{g.definition}</dd>
            {g.see && g.see.length > 0 && (
              <dd className="mt-1 flex flex-wrap gap-3 text-sm">
                {g.see.map((s) => (
                  <Link key={s.href} href={s.href} className="text-primary underline">
                    {s.label}
                  </Link>
                ))}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {shown.length === 0 && <p className="text-muted-foreground">No matching terms.</p>}
    </div>
  );
}
