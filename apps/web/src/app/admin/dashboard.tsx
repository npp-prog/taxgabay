"use client";

import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";

export interface VerificationRow {
  area: string;
  total: number;
  pending: number;
  where: string;
}

interface PendingRule {
  id: string;
  key: string;
  effective: string;
  legal_basis: string;
  low: boolean;
}

export function AdminDashboard({ rows, pendingRules }: { rows: VerificationRow[]; pendingRules: PendingRule[] }) {
  const [counts, setCounts] = React.useState<Record<string, number> | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    getSupabase()!
      .from("issuances")
      .select("workflow_state")
      .then(({ data }) => {
        if (cancelled) return;
        const c: Record<string, number> = { draft: 0, reviewed: 0, published: 0 };
        for (const r of (data ?? []) as { workflow_state: string }[]) c[r.workflow_state] = (c[r.workflow_state] ?? 0) + 1;
        setCounts(c);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const pendingTotal = rows.reduce((a, r) => a + r.pending, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {(["draft", "reviewed", "published"] as const).map((s) => (
          <Link key={s} href={`/admin/issuances?state=${s}`} className="group">
            <Card className="group-hover:border-primary">
              <CardHeader>
                <CardDescription className="capitalize">{s} issuances</CardDescription>
                <CardTitle className="text-3xl" data-testid={`count-${s}`}>
                  {counts ? counts[s] : "…"}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs verification</CardTitle>
          <CardDescription>
            {pendingTotal} bundled values are still unverified. These are code-reviewed data: confirm them in the files below, then run the tests (see docs/VERIFY.md).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Area</th>
                <th className="py-2 pr-3 text-right font-medium">Pending</th>
                <th className="py-2 font-medium">Where</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.area} className="border-b border-border/60">
                  <td className="py-2 pr-3">{r.area}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.pending} / {r.total}
                  </td>
                  <td className="py-2 font-mono text-xs">{r.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unverified tax rules ({pendingRules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {[...pendingRules].sort((a, b) => Number(b.low) - Number(a.low)).map((r) => (
              <li key={r.id} className="py-2">
                <span className="font-mono">{r.id}</span> {r.low && <Badge variant="warning">Low confidence</Badge>}
                <div className="text-muted-foreground">
                  {r.key} · {r.effective} · {r.legal_basis}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
