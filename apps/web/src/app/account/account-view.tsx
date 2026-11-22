"use client";

import Link from "next/link";
import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";
import { useUserData } from "@/lib/user-data";
import { ReminderSettingsCard } from "./reminder-settings";

export function AccountView() {
  const { data, session, deleteAccount } = useUserData();
  const [confirming, setConfirming] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function doDelete() {
    try {
      await deleteAccount();
      setMessage(session ? "Your account and all saved data have been deleted." : "Your saved data has been removed from this browser.");
    } catch (e) {
      setMessage(`Could not delete: ${(e as Error).message}`);
    }
    setConfirming(false);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "taxgabay-my-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Account and your data" />
      <Card>
        <CardHeader>
          <CardTitle>{session ? "Signed in" : "Not signed in"}</CardTitle>
          <CardDescription>
            {session
              ? `Signed in as ${session.user.email ?? "your account"}. Your profile and progress sync to your account.`
              : supabaseEnabled
                ? "Your profile and progress are stored only in this browser. Sign in to keep them across devices."
                : "Your profile and progress are stored only in this browser."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {session ? (
            <Button variant="outline" onClick={() => void getSupabase()?.auth.signOut()}>
              Sign out
            </Button>
          ) : (
            supabaseEnabled && (
              <Link href="/login" className={buttonVariants()}>
                Sign in or create an account
              </Link>
            )
          )}
          <Button variant="outline" onClick={exportData}>
            Download my data
          </Button>
        </CardContent>
      </Card>
      <ReminderSettingsCard />
      <Card>
        <CardHeader>
          <CardTitle>Delete my data</CardTitle>
          <CardDescription>
            {session
              ? "Permanently deletes your account, profile, calendar statuses and roadmap progress. This cannot be undone."
              : "Removes your profile and progress from this browser."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {confirming ? (
            <div className="flex flex-wrap gap-3">
              <Button variant="destructive" onClick={doDelete}>
                Yes, delete everything
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              {session ? "Delete my account" : "Clear my data"}
            </Button>
          )}
          {message && <p role="status" className="text-sm">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
