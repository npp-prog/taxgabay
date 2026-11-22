"use client";

import { draftIssuanceFromText, isAllowedSourceUrl, type IssuanceDraft } from "@taxgabay/content/ingest";
import { TAX_TYPE_LABELS } from "@taxgabay/content/issuances";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { INGEST_DRAFT_KEY } from "@/lib/admin";
import { extractText } from "@/lib/extract-text";
import { useUserData } from "@/lib/user-data";

export function IngestTool() {
  const router = useRouter();
  const { session } = useUserData();
  const [text, setText] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<IssuanceDraft | null>(null);

  async function fromFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      setText(await extractText(file, file.name));
      setSourceUrl(null);
    } catch (e) {
      setError(`Could not read the file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function fromUrl() {
    setError(null);
    if (!isAllowedSourceUrl(url)) return setError("Only https links on bir.gov.ph, dof.gov.ph or officialgazette.gov.ph are allowed.");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/source?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
      const finalUrl = res.headers.get("X-Source-Url") ?? url;
      setText(await extractText(await res.blob(), finalUrl));
      setSourceUrl(finalUrl);
    } catch (e) {
      setError(`Could not fetch the document: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function makeDraft() {
    setDraft(draftIssuanceFromText(text, sourceUrl));
  }

  function openInEditor() {
    try {
      window.sessionStorage.setItem(INGEST_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
    router.push("/admin/issuances/edit?from=ingest");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Draft an issuance from its source</h1>
        <p className="mt-1 text-muted-foreground">Paste the text, upload the PDF, or fetch it from the BIR website. We suggest the fields; you check them and save a draft. Nothing is published automatically.</p>
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ing-file">Upload a PDF, HTML or text file</Label>
            <Input id="ing-file" type="file" accept=".pdf,.html,.htm,.txt,application/pdf,text/html,text/plain" onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ing-url">Or fetch from a link</Label>
            <div className="flex gap-2">
              <Input id="ing-url" type="url" placeholder="https://www.bir.gov.ph/…" value={url} onChange={(e) => setUrl(e.target.value)} />
              <Button variant="outline" onClick={fromUrl} disabled={!url || busy}>
                Fetch
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ing-text">Issuance text</Label>
            <textarea id="ing-text" rows={10} className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the text of the issuance here" />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={makeDraft} disabled={!text.trim() || busy}>
              {busy ? "Reading…" : "Suggest fields"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {draft && (
        <Card data-testid="ingest-draft">
          <CardHeader>
            <CardTitle>Suggested fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">Type and number</dt>
              <dd data-testid="draft-id">{draft.type && draft.number ? `${draft.type} ${draft.number}` : "Not found"}</dd>
              <dt className="text-muted-foreground">Title</dt>
              <dd>{draft.title ?? "Not found"}</dd>
              <dt className="text-muted-foreground">Date issued</dt>
              <dd>{draft.date_issued ?? "Not found"}</dd>
              <dt className="text-muted-foreground">Tax types</dt>
              <dd>{draft.tax_types.map((t) => TAX_TYPE_LABELS[t] ?? t).join(", ") || "None detected"}</dd>
              <dt className="text-muted-foreground">Topics</dt>
              <dd>{draft.topics.join(", ") || "None detected"}</dd>
              <dt className="text-muted-foreground">References</dt>
              <dd>{draft.references.map((r) => `${r.type} ${r.number}${r.relation_guess ? ` (${r.relation_guess})` : ""}`).join("; ") || "None"}</dd>
            </dl>
            <ul className="list-disc pl-5 text-muted-foreground">
              {draft.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <Button onClick={openInEditor}>Open in the editor</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
