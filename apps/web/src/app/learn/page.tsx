import { HUB_CATEGORIES } from "@taxgabay/content/hub";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listHubArticles } from "@/lib/hub";

export const metadata: Metadata = { title: "Knowledge hub" };

export default function LearnPage() {
  const articles = listHubArticles();
  return (
    <div className="space-y-8">
      <PageHeader title="Knowledge hub" description="Plain-language explainers on Philippine taxes, common mistakes and myths." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/learn/glossary" className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardHeader>
              <CardTitle>Glossary</CardTitle>
              <CardDescription>BIR and tax terms explained, with Filipino and Taglish names.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/learn/faq" className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardHeader>
              <CardTitle>Frequently asked questions</CardTitle>
              <CardDescription>Quick answers about registering, filing, VAT, withholding and penalties.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
      {HUB_CATEGORIES.map((c) => {
        const list = articles.filter((a) => a.category === c.key);
        if (list.length === 0) return null;
        return (
          <section key={c.key} aria-labelledby={`cat-${c.key}`}>
            <h2 id={`cat-${c.key}`} className="mb-3 text-xl font-semibold">
              {c.label}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((a) => (
                <li key={a.slug}>
                  <Link href={`/learn/${a.slug}`} className="group block h-full">
                    <Card className="h-full transition-colors group-hover:border-primary">
                      <CardHeader>
                        <CardTitle className="text-base">{a.title}</CardTitle>
                        <CardDescription>{a.summary}</CardDescription>
                      </CardHeader>
                    </Card>
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
