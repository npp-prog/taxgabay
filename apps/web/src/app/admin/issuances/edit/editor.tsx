"use client";

import type { IssuanceDraft } from "@taxgabay/content/ingest";
import {
  ISSUANCE_STATUSES,
  ISSUANCE_TYPES,
  RELATIONS,
  TAX_TYPE_LABELS,
  canTransition,
  issuanceLabel,
  issuanceSlug,
  reviewBlockers,
  validateIssuance,
  type Issuance,
  type IssuanceType,
  type Relation,
  type WorkflowState,
} from "@taxgabay/content/issuances";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { ISSUANCE_COLUMNS, type IssuanceLinkRow, type IssuanceRow } from "@/lib/issuances-data";
import { INGEST_DRAFT_KEY } from "@/lib/admin";
import { getSupabase } from "@/lib/supabase";

type Form = Omit<Issuance, "slug" | "needs_verification">;

const EMPTY: Form = { type: "RR", number: "", title: "", date_issued: null, effectivity_date: null, tax_types: [], topics: [], summary_plain: null, status: "active", source_url: null };

function draftToForm(d: IssuanceDraft): Form {
  return { ...EMPTY, type: d.type ?? "RR", number: d.number ?? "", title: d.title ?? "", date_issued: d.date_issued, tax_types: d.tax_types.filter((t) => t in TAX_TYPE_LABELS), topics: d.topics, source_url: d.source_url };
}

function readIngestDraft(): IssuanceDraft | null {
  try {
    const raw = window.sessionStorage.getItem(INGEST_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as IssuanceDraft) : null;
  } catch {
    return null;
  }
}

type Brief = Pick<IssuanceRow, "id" | "slug" | "type" | "number" | "title">;

export function IssuanceEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const fromIngest = params.get("from") === "ingest";
  const [ingest] = React.useState<IssuanceDraft | null>(() => (fromIngest ? readIngestDraft() : null));
  const [form, setForm] = React.useState<Form>(() => (ingest ? draftToForm(ingest) : EMPTY));
  const [row, setRow] = React.useState<IssuanceRow | null>(null);
  const [all, setAll] = React.useState<Brief[]>([]);
  const [links, setLinks] = React.useState<IssuanceLinkRow[]>([]);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [newLink, setNewLink] = React.useState<{ relation: Relation; to: string }>({ relation: "amends", to: "" });
  const [reloadKey, setReloadKey] = React.useState(0);
  const sb = getSupabase()!;

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      id ? sb.from("issuances").select(ISSUANCE_COLUMNS).eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
      sb.from("issuances").select("id,slug,type,number,title").order("slug"),
      id ? sb.from("issuance_links").select("from_id,to_id,relation").or(`from_id.eq.${id},to_id.eq.${id}`) : Promise.resolve({ data: [] }),
    ]).then(([r, a, l]) => {
      if (cancelled) return;
      const current = (r.data as unknown as IssuanceRow | null) ?? null;
      setRow(current);
      if (current) {
        const { id: _i, slug: _s, needs_verification: _n, workflow_state: _w, reviewed_at: _ra, reviewed_by: _rb, added_by: _ab, updated_at: _u, ...rest } = current;
        void [_i, _s, _n, _w, _ra, _rb, _ab, _u];
        setForm(rest);
      }
      setAll((a.data ?? []) as Brief[]);
      setLinks((l.data ?? []) as IssuanceLinkRow[]);
    });
    return () => {
      cancelled = true;
    };
  }, [id, sb, reloadKey]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const problems = validateIssuance(form);
  const blockers = reviewBlockers(form);
  const state: WorkflowState = row?.workflow_state ?? "draft";
  const brief = new Map(all.map((b) => [b.id, b]));

  async function save() {
    setMessage(null);
    if (problems.length) return setMessage({ kind: "error", text: problems.join(" ") });
    const payload = { ...form, slug: issuanceSlug(form.type, form.number), topics: form.topics.map((t) => t.trim()).filter(Boolean) };
    if (!id) {
      const { data, error } = await sb.from("issuances").insert({ ...payload, workflow_state: "draft" }).select("id").single();
      if (error) return setMessage({ kind: "error", text: error.message });
      try {
        window.sessionStorage.removeItem(INGEST_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      router.replace(`/admin/issuances/edit?id=${(data as { id: string }).id}${ingest ? "&from=ingest" : ""}`);
      setMessage({ kind: "ok", text: "Saved as a draft." });
      return;
    }
    const { error } = await sb.from("issuances").update(payload).eq("id", id);
    if (error) return setMessage({ kind: "error", text: error.message });
    setMessage({ kind: "ok", text: state === "draft" ? "Saved." : "Saved. The issuance went back to draft and needs a new review." });
    setReloadKey((k) => k + 1);
  }

  async function move(to: WorkflowState) {
    setMessage(null);
    const { error } = await sb.from("issuances").update({ workflow_state: to }).eq("id", id!);
    if (error) return setMessage({ kind: "error", text: error.message });
    setMessage({ kind: "ok", text: `Moved to ${to}.` });
    setReloadKey((k) => k + 1);
  }

  async function addLink(to: string, relation: Relation) {
    const { error } = await sb.from("issuance_links").insert({ from_id: id, to_id: to, relation });
    if (error) return setMessage({ kind: "error", text: error.message });
    setReloadKey((k) => k + 1);
  }

  async function removeLink(l: IssuanceLinkRow) {
    const { error } = await sb.from("issuance_links").delete().match(l);
    if (error) return setMessage({ kind: "error", text: error.message });
    setReloadKey((k) => k + 1);
  }

  const suggestions = (ingest?.references ?? [])
    .map((r) => ({ r, target: all.find((b) => b.slug === r.slug) }))
    .filter((x) => !links.some((l) => l.from_id === id && l.to_id === x.target?.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{id ? `Edit ${row ? issuanceLabel(row) : "issuance"}` : "New issuance"}</h1>
        {id && <Badge variant={state === "published" ? "success" : state === "reviewed" ? "warning" : "muted"} data-testid="workflow-state">{state}</Badge>}
      </div>
      {ingest && <p className="rounded-md bg-muted p-3 text-sm">Pre-filled from the source document. Check every field — the parser only suggests values. {ingest.notes.join(" ")}</p>}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ed-type">Type</Label>
            <Select id="ed-type" value={form.type} onChange={(e) => set("type", e.target.value as IssuanceType)}>
              {ISSUANCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-number">Number</Label>
            <Input id="ed-number" placeholder="e.g. 8-2018" value={form.number} onChange={(e) => set("number", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ed-title">Title</Label>
            <Input id="ed-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-issued">Date issued</Label>
            <Input id="ed-issued" type="date" value={form.date_issued ?? ""} onChange={(e) => set("date_issued", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-effective">Effectivity date</Label>
            <Input id="ed-effective" type="date" value={form.effectivity_date ?? ""} onChange={(e) => set("effectivity_date", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-status">Status</Label>
            <Select id="ed-status" value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])}>
              {ISSUANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-source">Official source link</Label>
            <Input id="ed-source" type="url" placeholder="https://www.bir.gov.ph/…" value={form.source_url ?? ""} onChange={(e) => set("source_url", e.target.value || null)} />
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Tax types</legend>
            <div className="flex flex-wrap gap-3">
              {Object.entries(TAX_TYPE_LABELS).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.tax_types.includes(k)}
                    onChange={(e) => set("tax_types", e.target.checked ? [...form.tax_types, k] : form.tax_types.filter((t) => t !== k))}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ed-topics">Topics (comma-separated)</Label>
            <Input id="ed-topics" value={form.topics.join(", ")} onChange={(e) => set("topics", e.target.value.split(","))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ed-summary">Plain-language summary</Label>
            <textarea
              id="ed-summary"
              rows={5}
              className="w-full rounded-md border border-input bg-background p-3 text-base sm:text-sm"
              value={form.summary_plain ?? ""}
              onChange={(e) => set("summary_plain", e.target.value || null)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button onClick={save}>{id ? "Save changes" : "Save as draft"}</Button>
            {id && state !== "draft" && <span className="text-sm text-muted-foreground">Saving content changes sends this issuance back to draft for re-review.</span>}
          </div>
        </CardContent>
      </Card>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-destructive" : "text-success"}>
          {message.text}
        </p>
      )}

      {id && (
        <Card>
          <CardHeader>
            <CardTitle>Review and publishing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Draft → Reviewed → Published. Nothing is published automatically.</p>
            {canTransition(state, "reviewed") && blockers.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-warning-foreground">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {canTransition(state, "reviewed") && (
                <Button onClick={() => move("reviewed")} disabled={blockers.length > 0}>
                  Mark as reviewed
                </Button>
              )}
              {canTransition(state, "published") && <Button onClick={() => move("published")}>Publish</Button>}
              {canTransition(state, "draft") && (
                <Button variant="outline" onClick={() => move("draft")}>
                  {state === "published" ? "Unpublish (back to draft)" : "Back to draft"}
                </Button>
              )}
            </div>
            {row?.reviewed_at && <p className="text-sm text-muted-foreground">Reviewed {new Date(row.reviewed_at).toLocaleString("en-PH")}</p>}
          </CardContent>
        </Card>
      )}

      {id && (
        <Card>
          <CardHeader>
            <CardTitle>Related issuances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-1 text-sm" data-testid="admin-links">
              {links.map((l) => {
                const out = l.from_id === id;
                const other = brief.get(out ? l.to_id : l.from_id);
                return (
                  <li key={`${l.from_id}${l.to_id}${l.relation}`} className="flex items-center justify-between gap-2">
                    <span>
                      {out ? `This ${l.relation}` : `${l.relation} this:`} <span className="font-mono">{other ? issuanceLabel(other) : "unknown"}</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => removeLink(l)}>
                      Remove
                    </Button>
                  </li>
                );
              })}
              {links.length === 0 && <li className="text-muted-foreground">None yet.</li>}
            </ul>
            {suggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Suggested from the source document</p>
                <ul className="space-y-1 text-sm">
                  {suggestions.map(({ r, target }) => (
                    <li key={r.slug} className="flex items-center justify-between gap-2">
                      <span>
                        {r.relation_guess ?? "related to"} <span className="font-mono">{`${r.type} ${r.number}`}</span>
                        {!target && " (not in the library yet)"}
                      </span>
                      {target && (
                        <Button size="sm" variant="outline" onClick={() => addLink(target.id, r.relation_guess ?? "clarifies")}>
                          Add link
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="ln-rel">This issuance…</Label>
                <Select id="ln-rel" value={newLink.relation} onChange={(e) => setNewLink({ ...newLink, relation: e.target.value as Relation })}>
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln-to">Issuance</Label>
                <Select id="ln-to" value={newLink.to} onChange={(e) => setNewLink({ ...newLink, to: e.target.value })}>
                  <option value="">Choose…</option>
                  {all
                    .filter((b) => b.id !== id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {issuanceLabel(b)} — {b.title}
                      </option>
                    ))}
                </Select>
              </div>
              <Button variant="outline" disabled={!newLink.to} onClick={() => addLink(newLink.to, newLink.relation)}>
                Add link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Link href="/admin/issuances" className="text-sm text-primary underline">
        ← All issuances
      </Link>
    </div>
  );
}
