import { BUSINESS_CATEGORIES } from "@taxgabay/content/business";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { listBusinessChapters } from "@/lib/business";

export const metadata: Metadata = {
  title: "Business guide",
  description: "Bookkeeping, payroll, LGU permits and financial statements for small Philippine businesses.",
};

export default function BusinessGuidePage() {
  const chapters = listBusinessChapters();
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Business guide"
        title="Running the books of a small business"
        description="What to record, which permits to renew, what an employer pays, and how to read your financial statements — in plain language, with the law behind each step."
      />
      <Link href="/practice" className="group block">
        <article className="form-box flex flex-col gap-2 border-ink bg-sun-soft p-5 transition-colors group-hover:border-primary sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="form-label">Learn by doing</p>
            <h2 className="font-display text-xl font-bold group-hover:text-primary">Practice sets: keep the books of a sample business</h2>
            <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              Record each transaction of a fictional Philippine business and see the ledger, financial statements and tax returns built from your entries.
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-primary" aria-hidden="true">
            Start practising →
          </span>
        </article>
      </Link>
      {BUSINESS_CATEGORIES.map((c) => {
        const list = chapters.filter((a) => a.category === c.key);
        if (list.length === 0) return null;
        return (
          <section key={c.key} aria-labelledby={`cat-${c.key}`} className="space-y-3">
            <h2 id={`cat-${c.key}`} className="form-label">
              {c.label}
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {list.map((a) => (
                <li key={a.slug}>
                  <Link href={`/business-guide/${a.slug}`} className="group block h-full">
                    <article className="form-box flex h-full flex-col gap-2 p-5 transition-colors group-hover:border-primary">
                      <h3 className="font-display text-lg font-bold group-hover:text-primary">{a.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{a.summary}</p>
                      {a.needs_verification && (
                        <div className="mt-auto pt-1">
                          <Badge variant="warning">Pending CPA review</Badge>
                        </div>
                      )}
                    </article>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
