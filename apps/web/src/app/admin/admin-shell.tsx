"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { useAdminStatus } from "@/lib/admin";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/issuances", label: "Issuances" },
  { href: "/admin/ingest", label: "Draft from source" },
  { href: "/admin/calendar-data", label: "Extensions & holidays" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const status = useAdminStatus();
  const pathname = usePathname();

  if (status === "loading") return <p>Loading…</p>;
  if (status !== "admin") {
    const msg = {
      disabled: "The admin area needs Supabase. Set the Supabase environment variables to enable accounts and the issuance library database (see the README).",
      signed_out: "Sign in with an admin account to continue.",
      not_admin: "Your account is not an admin. Ask the project owner to set app_metadata.role = \"admin\" on your user.",
    }[status];
    return (
      <div className="mx-auto max-w-xl space-y-4" data-testid="admin-gate">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p>{msg}</p>
        {status === "signed_out" && (
          <Link href="/login" className={buttonVariants()}>
            Sign in
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <nav aria-label="Admin" className="flex flex-wrap gap-1 border-b border-border pb-3">
        {NAV.map((n) => {
          const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm hover:bg-muted", active && "bg-secondary font-medium text-secondary-foreground")}>
              {n.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
