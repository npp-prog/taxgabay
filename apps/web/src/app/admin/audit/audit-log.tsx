"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { changedFields } from "@/lib/audit";
import { getSupabase } from "@/lib/supabase";

interface AuditRow {
  id: number;
  table_name: string;
  row_pk: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  actor: string | null;
  at: string;
}

export function AuditLog() {
  const [rows, setRows] = React.useState<AuditRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    getSupabase()!
      .from("admin_audit_log")
      .select("*")
      .order("at", { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setRows((data ?? []) as AuditRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-sm text-muted-foreground">The latest 200 changes to reference data and issuances.</p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!rows && !error && <p>Loading…</p>}
      <ul className="divide-y divide-border text-sm" data-testid="audit-rows">
        {rows?.map((r) => (
          <li key={r.id} className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={r.action === "DELETE" ? "warning" : "muted"}>{r.action}</Badge>
              <span className="font-mono">{r.table_name}</span>
              <span className="font-mono text-muted-foreground">{r.row_pk}</span>
              <span className="text-muted-foreground">{new Date(r.at).toLocaleString("en-PH")}</span>
            </div>
            {r.action === "UPDATE" && <div className="text-muted-foreground">Changed: {changedFields(r).join(", ") || "—"}</div>}
            <div className="text-xs text-muted-foreground">By {r.actor ?? "system (seed or service role)"}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
