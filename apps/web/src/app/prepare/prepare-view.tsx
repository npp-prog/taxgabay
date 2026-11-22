"use client";

import Link from "next/link";
import * as React from "react";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { REVIEWER } from "@/lib/prepare-pdf";
import { supabaseEnabled } from "@/lib/supabase";
import { useUserData } from "@/lib/user-data";
import { claimClient, loadMembership, type Membership } from "@/lib/workspace";
import { ClientPortal } from "./client-portal";
import { LocalPrepare } from "./local-prepare";
import { input, label } from "./parts";

function useMembership() {
  const { ready, session } = useUserData();
  const userId = session?.user.id ?? null;
  const [state, setState] = React.useState<{ userId: string; m: Membership | null; error: string | null } | null>(null);
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    if (!userId) return;
    let live = true;
    loadMembership(userId).then(
      (m) => live && setState({ userId, m, error: null }),
      (e: Error) => live && setState({ userId, m: null, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [userId, nonce]);
  const current = state && state.userId === userId ? state : null;
  return { ready, userId, membership: current?.m ?? null, error: current?.error ?? null, loading: !!userId && !current, reload: () => setNonce((n) => n + 1) };
}

export function PrepareView() {
  const { ready, userId, membership, error, loading, reload } = useMembership();

  const header = (
    <PageHeader
      eyebrow="Document preparation"
      title="Prepare my BIR documents"
      description="Enter your sales, expenses and the Forms 2307 your customers gave you. TaxGabay checks them and prepares your returns, schedules and certificates for the quarter. You review, sign and file them yourself."
    />
  );

  let body: React.ReactNode;
  if (!supabaseEnabled) body = <LocalPrepare />;
  else if (!ready || loading) body = <p className="text-muted-foreground">Loading…</p>;
  else if (!userId)
    body = (
      <LocalPrepare
        banner={
          <div className="form-box flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm">
              <strong>Client of {REVIEWER}&apos;s firm?</strong> Sign in to keep your records safely on our servers and receive your reviewed filing packet.
            </p>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Sign in
            </Link>
          </div>
        }
      />
    );
  else if (error) body = <p role="alert" className="text-destructive">Could not load your account: {error}</p>;
  else if (membership && membership.clientIds.length > 0) body = <ClientPortal clientId={membership.clientIds[0]!} userId={userId} />;
  else
    body = (
      <div className="space-y-8">
        {membership?.firmRole && (
          <div className="form-box flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm">
              You are on the firm team ({membership.firmRole}). Prepare, review and release clients&apos; packets in the firm workspace.
            </p>
            <Link href="/firm" className={buttonVariants({ size: "sm" })}>
              Open the firm workspace
            </Link>
          </div>
        )}
        {!membership?.firmRole && <ClaimCard onClaimed={reload} />}
      </div>
    );

  return (
    <div className="space-y-8">
      {header}
      {body}
      <Disclaimer lastVerified={null} />
    </div>
  );
}

function ClaimCard({ onClaimed }: { onClaimed: () => void }) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await claimClient(code);
      onClaimed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-box max-w-xl space-y-4 p-6" data-testid="claim-card">
      <h2 className="text-lg font-semibold">Link your account to your business</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">Enter the invite code you received from {REVIEWER}&apos;s firm. You only need to do this once.</p>
      <div>
        <label className={label} htmlFor="invite">
          Invite code
        </label>
        <input id="invite" className={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ABCD-EF2345" autoComplete="off" required />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Linking…" : "Link my account"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
