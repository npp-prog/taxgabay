import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listGuides } from "@/lib/guides";

export const metadata: Metadata = { title: "Filing guides" };

export default function GuidesPage() {
  const guides = listGuides();
  return (
    <div>
      <PageHeader title="Filing guides" description="Who files, when, where, what to attach and common mistakes — one guide per BIR form." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="group block h-full">
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold">{g.form}</span>
                    {g.status !== "published" && <Badge variant="muted">Draft</Badge>}
                  </div>
                  <CardTitle className="text-base font-medium">{g.title.replace(/^BIR Form \S+ — /, "")}</CardTitle>
                  <CardDescription>{g.legal_basis[0]}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
