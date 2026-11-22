import { practiceSets } from "@taxgabay/accounting";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { TrackSwitch } from "./track-switch";

export const metadata: Metadata = { title: "Practice sets" };

const FORM: Record<string, string> = { sole_proprietorship: "Sole proprietorship", corporation: "Corporation" };

export default function PracticePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Accounting practice sets"
        title="Keep the books of a sample business"
        description="Each practice set is a small Philippine business with real-looking invoices, receipts and payroll. Record every transaction, and TaxGabay checks your entry, posts it to the ledger, and builds the trial balance, financial statements and tax returns from your work."
      />
      <section aria-labelledby="track-h" className="space-y-3">
        <h2 id="track-h" className="form-label">
          1 · Choose your track
        </h2>
        <TrackSwitch />
      </section>
      <section aria-labelledby="sets-h" className="space-y-3">
        <h2 id="sets-h" className="form-label">
          2 · Pick a business
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {practiceSets.map((s) => (
            <li key={s.slug}>
              <Link href={`/practice/${s.slug}`} className="group block h-full">
                <div className="form-box flex h-full flex-col gap-3 p-5 transition-colors group-hover:border-primary">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{FORM[s.business.form]}</Badge>
                    <Badge variant="muted">{s.business.profile.vat_status === "vat" ? "VAT" : "Non-VAT"}</Badge>
                    <Badge variant="muted">{s.level}</Badge>
                  </div>
                  <h3 className="font-display text-xl font-bold group-hover:text-primary">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
                  <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-dashed border-border pt-3 text-sm">
                    <div>
                      <dt className="form-label">Period</dt>
                      <dd className="mt-0.5">{s.period.label}</dd>
                    </div>
                    <div>
                      <dt className="form-label">Transactions</dt>
                      <dd className="mt-0.5 font-mono">{s.transactions.length}</dd>
                    </div>
                    <div>
                      <dt className="form-label">Adjustments</dt>
                      <dd className="mt-0.5 font-mono">{s.adjustments.length}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="max-w-[80ch] border-l-2 border-sun pl-4 text-sm leading-relaxed text-muted-foreground">
        The businesses are fictional. Tax amounts in the practice sets are computed with TaxGabay&apos;s rule tables, which are still being verified by a CPA. New to bookkeeping? Start with the{" "}
        <Link href="/business-guide" className="text-primary underline">
          business guide
        </Link>
        .
      </p>
    </div>
  );
}
