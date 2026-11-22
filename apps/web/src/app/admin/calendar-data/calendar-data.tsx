"use client";

import { forms } from "@taxgabay/tax-engine";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase";

interface ExtRow {
  id: string;
  form_code: string;
  original_date: string;
  new_date: string;
  issuance_ref: string;
}
interface HolRow {
  date: string;
  name: string;
  type: "regular" | "special_non_working";
  legal_basis: string;
}

export function CalendarDataAdmin() {
  const sb = getSupabase()!;
  const [exts, setExts] = React.useState<ExtRow[]>([]);
  const [hols, setHols] = React.useState<HolRow[]>([]);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  const [ext, setExt] = React.useState({ form_code: "1701Q", original_date: "", new_date: "", issuance_ref: "" });
  const [hol, setHol] = React.useState<HolRow>({ date: "", name: "", type: "regular", legal_basis: "" });

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      sb.from("deadline_extensions").select("id,form_code,original_date,new_date,issuance_ref").order("original_date", { ascending: false }),
      sb.from("holidays").select("date,name,type,legal_basis").order("date", { ascending: false }),
    ]).then(([e, h]) => {
      if (cancelled) return;
      setExts((e.data ?? []) as ExtRow[]);
      setHols((h.data ?? []) as HolRow[]);
    });
    return () => {
      cancelled = true;
    };
  }, [sb, reload]);

  const done = (error: { message: string } | null, ok: string) => {
    setMsg(error ? error.message : ok);
    if (!error) setReload((r) => r + 1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Extensions and holidays</h1>
      {msg && <p role="status">{msg}</p>}
      <Card>
        <CardHeader>
          <CardTitle>BIR deadline extensions</CardTitle>
          <CardDescription>When the BIR moves a deadline (e.g. by RMC), add it here. The calendar and reminders use the new date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-5 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="ext-form">Form</Label>
              <Select id="ext-form" value={ext.form_code} onChange={(e) => setExt({ ...ext, form_code: e.target.value })}>
                {forms.filter((f) => f.frequency !== "one_time").map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-orig">Original due date</Label>
              <Input id="ext-orig" type="date" value={ext.original_date} onChange={(e) => setExt({ ...ext, original_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-new">New due date</Label>
              <Input id="ext-new" type="date" value={ext.new_date} onChange={(e) => setExt({ ...ext, new_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-ref">Issuance</Label>
              <Input id="ext-ref" placeholder="e.g. RMC 00-2026" value={ext.issuance_ref} onChange={(e) => setExt({ ...ext, issuance_ref: e.target.value })} />
            </div>
            <Button
              disabled={!ext.original_date || !ext.new_date || !ext.issuance_ref.trim()}
              onClick={async () => {
                const { error } = await sb.from("deadline_extensions").insert(ext);
                done(error, "Extension added.");
              }}
            >
              Add extension
            </Button>
          </div>
          <ul className="divide-y divide-border text-sm">
            {exts.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-mono">{e.form_code}</span> {e.original_date} → {e.new_date} ({e.issuance_ref})
                </span>
                <Button variant="ghost" size="sm" onClick={async () => done((await sb.from("deadline_extensions").delete().eq("id", e.id)).error, "Extension removed.")}>
                  Remove
                </Button>
              </li>
            ))}
            {exts.length === 0 && <li className="py-2 text-muted-foreground">No extensions yet.</li>}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holidays</CardTitle>
          <CardDescription>Add each year&apos;s proclaimed holidays (including Eid&apos;l Fitr and Eid&apos;l Adha). Rows here override the bundled list for the same date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-5 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="hol-date">Date</Label>
              <Input id="hol-date" type="date" value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hol-name">Name</Label>
              <Input id="hol-name" value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hol-type">Type</Label>
              <Select id="hol-type" value={hol.type} onChange={(e) => setHol({ ...hol, type: e.target.value as HolRow["type"] })}>
                <option value="regular">Regular holiday</option>
                <option value="special_non_working">Special non-working day</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hol-basis">Proclamation</Label>
              <Input id="hol-basis" placeholder="e.g. Proclamation No. …" value={hol.legal_basis} onChange={(e) => setHol({ ...hol, legal_basis: e.target.value })} />
            </div>
            <Button
              disabled={!hol.date || !hol.name.trim() || !hol.legal_basis.trim()}
              onClick={async () => {
                const { error } = await sb.from("holidays").upsert({ ...hol, year: Number(hol.date.slice(0, 4)), needs_verification: false });
                done(error, "Holiday saved.");
              }}
            >
              Save holiday
            </Button>
          </div>
          <ul className="divide-y divide-border text-sm">
            {hols.slice(0, 60).map((h) => (
              <li key={h.date} className="flex items-center justify-between py-2">
                <span>
                  {h.date} — {h.name} <span className="text-muted-foreground">({h.type === "regular" ? "regular" : "special"})</span>
                </span>
                <Button variant="ghost" size="sm" onClick={async () => done((await sb.from("holidays").delete().eq("date", h.date)).error, "Holiday removed.")}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
