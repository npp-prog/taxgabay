"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { buildPdf, downloadPdf, type PdfDoc } from "@/lib/pdf";

export function PdfButton({ filename, build, label = "Download PDF", className }: { filename: string; build: () => PdfDoc; label?: string; className?: string }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      downloadPdf(await buildPdf(build()), filename);
    } catch (e) {
      setError(`Could not create the PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className={className}>
      <Button variant="outline" size="sm" onClick={onClick} disabled={busy} data-testid="pdf-button">
        {busy ? "Preparing…" : label}
      </Button>
      {error && (
        <span role="alert" className="ml-2 text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
