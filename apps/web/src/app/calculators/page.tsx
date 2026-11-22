import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Tax calculators" };

const CALCS = [
  { href: "/calculators/income-tax", title: "Income tax: 8% vs graduated", body: "Compare the 8% option with graduated rates (OSD or itemized) for self-employed and mixed-income individuals." },
  { href: "/calculators/percentage-tax", title: "Percentage tax", body: "Quarterly percentage tax for non-VAT taxpayers (Form 2551Q)." },
  { href: "/calculators/vat", title: "VAT", body: "Output VAT less input VAT, with VAT-inclusive conversion and carry-over (Form 2550Q)." },
  { href: "/calculators/penalty", title: "Late filing/payment penalty", body: "Surcharge, interest and compromise penalty, with reduced rates for micro and small taxpayers." },
];

export default function CalculatorsPage() {
  return (
    <div>
      <PageHeader title="Tax calculators" description="Every result shows the step-by-step computation and the legal basis for each line. No account needed." />
      <div className="grid gap-4 sm:grid-cols-2">
        {CALCS.map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle>{c.title}</CardTitle>
                <CardDescription>{c.body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Coming in Phase 2: corporate income tax, withholding on compensation, expanded withholding, estate, donor&apos;s, capital gains and documentary stamp tax.
      </p>
    </div>
  );
}
