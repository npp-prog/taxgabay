"use client";

import { businessForm, deadlineRules, summarizeProfile } from "@taxgabay/tax-engine";
import Link from "next/link";
import { ClientSwitcher } from "@/components/client-switcher";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserData } from "@/lib/user-data";
import { todayPH } from "@/lib/utils";

const FREQ: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual", one_time: "One-time", event: "When it happens" };

export function ProfileSummaryView() {
  const { data, ready } = useUserData();
  if (!ready) return <p>Loading…</p>;
  if (!data.profile) {
    return (
      <div className="space-y-4">
        <ClientSwitcher />
        <PageHeader title="What applies to you" description="Create your profile first so we can personalize this page." />
        <Link href="/profile" className={buttonVariants()}>
          Start my profile
        </Link>
      </div>
    );
  }
  const s = summarizeProfile(data.profile, deadlineRules, todayPH());
  const form = businessForm(data.profile.taxpayer_type);

  return (
    <div className="space-y-6">
      <ClientSwitcher />
      <PageHeader title="Here is what applies to you" description="Based on your profile. Items marked “Depends” need an answer you weren’t sure about." />
      <div className="flex flex-wrap gap-3">
        <Link href="/calendar" className={buttonVariants()}>
          See my tax calendar
        </Link>
        <Link href="/checklists" className={buttonVariants({ variant: "outline" })}>
          My checklists
        </Link>
        <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
          Edit profile
        </Link>
      </div>

      {s.tax_types.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Taxes you deal with</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2" aria-label="Tax types">
              {s.tax_types.map((t) => (
                <li key={t}>
                  <Badge variant="outline">{t}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {s.registrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5">
              {s.registrations.map((r) => (
                <li key={r.title}>
                  <span className="font-medium">{r.title}.</span> <span className="text-muted-foreground">{r.detail}</span>
                </li>
              ))}
            </ol>
            {form && (
              <Link href="/roadmap" className={buttonVariants({ variant: "link", className: "mt-2 px-0" })}>
                Open the step-by-step registration roadmap →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {s.returns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Returns you file</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border" data-testid="returns-list">
              {s.returns.map((r) => (
                <li key={r.code} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-mono font-semibold">{r.code}</span> — {r.title}
                    <div className="mt-1 flex gap-2">
                      <Badge variant="muted">{FREQ[r.frequency]}</Badge>
                      {r.applicability === "maybe" && <Badge variant="warning">Depends</Badge>}
                    </div>
                  </div>
                  {r.guide_slug ? (
                    <Link href={`/guides/${r.guide_slug}`} className="text-sm text-primary underline">
                      Filing guide
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Guide coming soon</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {s.notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Good to know</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {s.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <p className="text-sm text-muted-foreground">For guidance only. Verify with BIR issuances or consult a CPA. Rules shown are pending CPA verification.</p>
    </div>
  );
}
