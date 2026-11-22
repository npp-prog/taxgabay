"use client";

import Link from "next/link";
import { Label, Select } from "@/components/ui/input";
import { useUserData } from "@/lib/user-data";

/** Shown at the top of per-client pages when there are two or more clients. */
export function ClientSwitcher({ always = false }: { always?: boolean }) {
  const { clients, activeClientId, switchClient, ready } = useUserData();
  if (!ready || (!always && clients.length < 2)) return null;
  return (
    <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/50 p-3" data-testid="client-switcher">
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor="client-switch">Working on</Label>
        <Select id="client-switch" value={activeClientId} onChange={(e) => switchClient(e.target.value)}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <Link href="/clients" className="pb-2 text-sm text-primary underline">
        Manage clients
      </Link>
    </div>
  );
}
