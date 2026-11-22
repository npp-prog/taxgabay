"use client";

import { addDays, addMonths, deadlineRules, generateObligations, TAXPAYER_TYPES } from "@taxgabay/tax-engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useCalendarData } from "@/lib/calendar-data";
import { useUserData, type ClientData } from "@/lib/user-data";
import { formatDatePH, todayPH } from "@/lib/utils";

const TYPE_LABEL: Record<(typeof TAXPAYER_TYPES)[number], string> = {
  employee: "Employee",
  self_employed: "Self-employed / professional",
  mixed_income: "Mixed income",
  sole_proprietorship: "Sole proprietor",
  partnership: "Partnership",
  corporation: "Corporation",
  opc: "One Person Corporation",
  cooperative: "Cooperative",
  estate: "Estate",
  one_time: "One-time transaction",
};

function ClientRow({ c, active, canRemove, nextDue }: { c: ClientData; active: boolean; canRemove: boolean; nextDue: string | null }) {
  const { switchClient, renameClient, removeClient } = useUserData();
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(c.name);
  const [confirming, setConfirming] = React.useState(false);
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" data-testid="client-row">
      <div className="min-w-0 space-y-1">
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void renameClient(c.id, name);
              setEditing(false);
            }}
          >
            <Label htmlFor={`rename-${c.id}`} className="sr-only">
              New name for {c.name}
            </Label>
            <Input id={`rename-${c.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
            <Button type="submit" size="sm">
              Save
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{c.name}</span>
            {active && <Badge>Open now</Badge>}
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          {c.profile ? TYPE_LABEL[c.profile.taxpayer_type] : "No profile yet"}
          {nextDue && ` · next deadline ${formatDatePH(nextDue)}`}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            switchClient(c.id);
            router.push(c.profile ? "/calendar" : "/profile");
          }}
          aria-label={`Open ${c.name}`}
        >
          Open
        </Button>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} aria-label={`Rename ${c.name}`}>
            Rename
          </Button>
        )}
        {canRemove &&
          (confirming ? (
            <>
              <Button size="sm" variant="destructive" onClick={() => void removeClient(c.id)}>
                Yes, remove {c.name}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={`Remove ${c.name}`}>
              Remove
            </Button>
          ))}
      </div>
    </li>
  );
}

export function ClientsView() {
  const { clients, activeClientId, addClient, ready } = useUserData();
  const { holidays, extensions } = useCalendarData();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const today = todayPH();
  const to = addDays(addMonths(today, 12), -1);

  const nextDue = (c: ClientData): string | null => {
    if (!c.profile) return null;
    const pending = generateObligations(c.profile, { from: today, to, rules: deadlineRules, holidays, extensions }).find((o) => c.obligations[o.id] !== "filed_and_paid");
    return pending?.due_date ?? null;
  };

  if (!ready) return <p>Loading…</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Clients"
        description="For bookkeepers and accountants: keep a separate profile, calendar, checklists and registration progress for each client. Switch between them at the top of each page."
      />
      <Card>
        <CardContent className="pt-5">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await addClient(name);
                setName("");
              } catch (err) {
                setError(`Could not add the client: ${(err as Error).message}`);
              }
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="new-client">Client name</Label>
              <Input id="new-client" value={name} maxLength={120} placeholder="e.g. Aling Nena's Sari-sari Store" onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" disabled={!name.trim()}>
              Add client
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-2">
          <ul className="divide-y divide-border">
            {clients.map((c) => (
              <ClientRow key={c.id} c={c} active={c.id === activeClientId} canRemove={clients.length > 1} nextDue={nextDue(c)} />
            ))}
          </ul>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        The calendar can show every client&apos;s deadlines together: choose <strong>All clients</strong> on the{" "}
        <Link href="/calendar" className="underline">
          Calendar
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
