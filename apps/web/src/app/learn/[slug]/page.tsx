import { HUB_CATEGORIES } from "@taxgabay/content/hub";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/disclaimer";
import { Badge } from "@/components/ui/badge";
import { getHubArticle, listHubArticles } from "@/lib/hub";

export const dynamicParams = false;

export function generateStaticParams() {
  return listHubArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getHubArticle(slug);
  return { title: a?.frontmatter.title ?? "Article", description: a?.frontmatter.summary };
}

export default async function HubArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getHubArticle(slug);
  if (!article) notFound();
  const fm = article.frontmatter;
  const category = HUB_CATEGORIES.find((c) => c.key === fm.category)?.label ?? fm.category;
  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/learn" className="underline">
          Knowledge hub
        </Link>{" "}
        / {category}
      </nav>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{fm.title}</h1>
      <p className="mt-2 text-muted-foreground">{fm.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="muted">{category}</Badge>
        {fm.needs_verification && <Badge variant="warning">Pending CPA review</Badge>}
      </div>
      <Disclaimer lastVerified={fm.needs_verification ? null : fm.last_verified_at} className="my-6" />
      <div className="prose-guide">
        <MDXRemote source={article.body} />
      </div>
      {fm.related.length > 0 && (
        <section aria-labelledby="related" className="mt-8 rounded-lg border border-border p-4">
          <h2 id="related" className="font-semibold">
            Related
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {fm.related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="text-primary underline">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
