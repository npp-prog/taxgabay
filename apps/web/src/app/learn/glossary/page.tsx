import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { GlossaryList } from "./glossary-list";

export const metadata: Metadata = { title: "Glossary" };

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/learn" className="underline">
          Knowledge hub
        </Link>{" "}
        / Glossary
      </nav>
      <PageHeader title="Glossary" description="BIR and tax terms in plain language, with the Filipino or Taglish names you may hear." />
      <GlossaryList />
      <p className="mt-8 text-sm text-muted-foreground">For guidance only. Verify with BIR issuances or consult a CPA. Definitions are pending CPA review.</p>
    </div>
  );
}
