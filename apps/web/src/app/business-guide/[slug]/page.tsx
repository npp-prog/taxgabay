import { BUSINESS_CATEGORIES } from "@taxgabay/content/business";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { getBusinessChapter, listBusinessChapters } from "@/lib/business";

export const dynamicParams = false;

export function generateStaticParams() {
  return listBusinessChapters().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getBusinessChapter(slug);
  return { title: a?.frontmatter.title ?? "Business guide", description: a?.frontmatter.summary };
}

export default async function BusinessChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = getBusinessChapter(slug);
  if (!chapter) notFound();
  const fm = chapter.frontmatter;
  const category = BUSINESS_CATEGORIES.find((c) => c.key === fm.category)?.label ?? fm.category;
  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/business-guide" className="underline">
          Business guide
        </Link>{" "}
        / {category}
      </nav>
      <PageHeader eyebrow={category} title={fm.title} description={fm.summary} />
      <div className="-mt-4 flex flex-wrap gap-2">
        <Badge variant="muted">{category}</Badge>
        {fm.needs_verification && <Badge variant="warning">Pending CPA review</Badge>}
      </div>
      <Disclaimer lastVerified={fm.needs_verification ? null : fm.last_verified_at} className="my-6" />
      <div className="prose-guide">
        <MDXRemote source={chapter.body} />
      </div>
      {fm.related.length > 0 && (
        <section aria-labelledby="related" className="form-box mt-8 p-4">
          <h2 id="related" className="form-label">
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
