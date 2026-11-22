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
  { href: "/calculators/corporate", title: "Corporate income tax", body: "Regular corporate income tax (RCIT) vs minimum corporate income tax (MCIT), with the reduced rate check." },
  { href: "/calculators/withholding-compensation", title: "Withholding on compensation", body: "Tax to withhold from employees each payroll, and the year-end adjustment." },
  { href: "/calculators/ewt", title: "Expanded withholding tax", body: "Tax to withhold from rent, professional fees, contractors and suppliers, by ATC." },
  { href: "/calculators/estate", title: "Estate tax", body: "Net estate and estate tax, with the standard deduction, family home and spouse's share." },
  { href: "/calculators/donors", title: "Donor's tax", body: "Tax on gifts, computed on all gifts in the calendar year." },
  { href: "/calculators/cgt", title: "Capital gains tax", body: "Sale of real property (capital asset) or unlisted shares." },
  { href: "/calculators/dst", title: "Documentary stamp tax", body: "Deeds of sale, original issue of shares, and loans." },
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
    </div>
  );
}
