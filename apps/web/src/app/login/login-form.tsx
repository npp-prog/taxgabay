"use client";

import Link from "next/link";
import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";

function redirectTo() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  return `${base}/account`;
}

export function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!supabaseEnabled) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <PageHeader title="Sign in" />
        <p>
          Accounts are not enabled on this deployment yet. Everything still works — your profile and progress are saved in this browser.
        </p>
        <Link href="/profile" className="text-primary underline">
          Go to my profile
        </Link>
      </div>
    );
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: err } = await getSupabase()!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    if (err) setError(err.message);
    else setSent(true);
  }

  async function google() {
    const { error: err } = await getSupabase()!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (err) setError(err.message);
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Sign in" description="Save your profile, calendar and progress to use on any device." />
      <Card>
        <CardContent className="space-y-4 pt-5">
          {sent ? (
            <p role="status">Check your email for a sign-in link.</p>
          ) : (
            <form onSubmit={magicLink} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full">
                Email me a sign-in link
              </Button>
            </form>
          )}
          <div className="text-center text-sm text-muted-foreground">or</div>
          <Button variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            By signing in you agree to our{" "}
            <Link href="/privacy" className="underline">
              privacy notice
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
