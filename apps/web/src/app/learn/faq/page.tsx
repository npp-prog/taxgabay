import { faqs } from "@taxgabay/content/faq";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Frequently asked questions" };

export default function FaqPage() {
  const categories = [...new Set(faqs.map((f) => f.category))];
  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/learn" className="underline">
          Knowledge hub
        </Link>{" "}
        / FAQs
      </nav>
      <PageHeader title="Frequently asked questions" description="Quick answers to common questions about BIR obligations." />
      <div className="space-y-8">
        {categories.map((c) => (
          <section key={c} aria-label={c}>
            <h2 className="mb-2 text-lg font-semibold">{c}</h2>
            <div className="divide-y divide-border rounded-lg border border-border">
              {faqs
                .filter((f) => f.category === c)
                .map((f) => (
                  <details key={f.id} id={f.id} className="group p-4">
                    <summary className="cursor-pointer font-medium">{f.question}</summary>
                    <p className="mt-2 text-muted-foreground">{f.answer}</p>
                    {f.see && f.see.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-3 text-sm">
                        {f.see.map((s) => (
                          <Link key={s.href} href={s.href} className="text-primary underline">
                            {s.label}
                          </Link>
                        ))}
                      </p>
                    )}
                  </details>
                ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">For guidance only. Verify with BIR issuances or consult a CPA. Answers are pending CPA review.</p>
    </div>
  );
}
