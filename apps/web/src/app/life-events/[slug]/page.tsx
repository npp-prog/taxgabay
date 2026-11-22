import { getForm, getLifeEvent, lifeEvents } from "@taxgabay/tax-engine";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/disclaimer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamicParams = false;

export function generateStaticParams() {
  return lifeEvents.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: getLifeEvent(slug)?.title ?? "Life event" };
}

export default async function LifeEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getLifeEvent(slug);
  if (!event) notFound();
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/life-events" className="underline">
          Life events
        </Link>{" "}
        / {event.title}
      </nav>
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title}</h1>
        <p className="mt-2 text-muted-foreground">{event.summary}</p>
      </header>
      <ol className="space-y-4">
        {event.steps.map((s, i) => (
          <li key={s.title}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">Step {i + 1}</Badge>
                  {s.form_code &&
                    (getForm(s.form_code)?.guide_slug ? (
                      <Link href={`/guides/${getForm(s.form_code)!.guide_slug}`}>
                        <Badge variant="outline">BIR Form {s.form_code} guide →</Badge>
                      </Link>
                    ) : (
                      <Badge variant="outline">BIR Form {s.form_code}</Badge>
                    ))}
                </div>
                <CardTitle className="mt-2">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{s.detail}</p>
                {s.deadline && (
                  <p>
                    <span className="font-medium">Deadline:</span> {s.deadline}
                  </p>
                )}
                {s.legal_basis && <p className="text-muted-foreground">Basis: {s.legal_basis}</p>}
                {s.links.length > 0 && (
                  <ul className="flex flex-wrap gap-3 pt-1">
                    {s.links.map((l) => (
                      <li key={l.href + l.label}>
                        <Link href={l.href} className="text-primary underline">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <Disclaimer lastVerified={null} />
    </article>
  );
}
