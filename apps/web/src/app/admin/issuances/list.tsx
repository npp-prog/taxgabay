"use client";

import { WORKFLOW_STATES, filterIssuances, issuanceLabel, type WorkflowState } from "@taxgabay/content/issuances";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { ISSUANCE_COLUMNS, type IssuanceRow } from "@/lib/issuances-data";
import { getSupabase } from "@/lib/supabase";

const STATE_VARIANT: Record<WorkflowState, "muted" | "warning" | "success"> = { draft: "muted", reviewed: "warning", published: "success" };

export function AdminIssuanceList() {
  const params = useSearchParams();
  const [rows, setRows] = React.useState<IssuanceRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<WorkflowState | "">((params.get("state") as WorkflowState) ?? "");
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    getSupabase()!
      .from("issuances")
      .select(ISSUANCE_COLUMNS)
      .order("updated_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setRows((data ?? []) as unknown as IssuanceRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = rows ? (filterIssuances(rows, { q }) as IssuanceRow[]).filter((r) => !state || r.workflow_state === state) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Issuances</h1>
        <div className="flex gap-2">
          <Link href="/admin/ingest" className={buttonVariants({ variant: "outline" })}>
            Draft from source
          </Link>
          <Link href="/admin/issuances/edit" className={buttonVariants()}>
            New issuance
          </Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="adm-q">Search issuances</Label>
          <Input id="adm-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adm-state">Workflow state</Label>
          <Select id="adm-state" value={state} onChange={(e) => setState(e.target.value as WorkflowState | "")}>
            <option value="">All</option>
            {WORKFLOW_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!rows && !error && <p>Loading…</p>}
      <ul className="divide-y divide-border" data-testid="admin-issuances">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <span className="font-mono font-semibold">{issuanceLabel(r)}</span> <Badge variant={STATE_VARIANT[r.workflow_state]}>{r.workflow_state}</Badge>
              <div className="text-sm text-muted-foreground">{r.title}</div>
            </div>
            <Link href={`/admin/issuances/edit?id=${r.id}`} className="text-sm text-primary underline">
              Edit
            </Link>
          </li>
        ))}
      </ul>
      {rows && shown.length === 0 && <p className="text-muted-foreground">No issuances match.</p>}
    </div>
  );
}
