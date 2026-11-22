import { lifeEvents } from "@taxgabay/tax-engine";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Life events" };

export default function LifeEventsPage() {
  return (
    <div>
      <PageHeader title="Life events" description="Step-by-step help for the big moments: what to file, when, and which tools to use." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {lifeEvents.map((e) => (
          <li key={e.slug}>
            <Link href={`/life-events/${e.slug}`} className="group block h-full">
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader>
                  <CardTitle>{e.title}</CardTitle>
                  <CardDescription>{e.summary}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
