import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/disclaimer";
import { Badge } from "@/components/ui/badge";
import { getGuide, listGuides } from "@/lib/guides";

export const dynamicParams = false;

export function generateStaticParams() {
  return listGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  return { title: g?.frontmatter.title ?? "Guide" };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const fm = guide.frontmatter;
  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/guides" className="underline">
          Filing guides
        </Link>{" "}
        / {fm.form}
      </nav>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{fm.title}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {fm.status !== "published" && <Badge variant="warning">Draft — being completed by our CPA</Badge>}
        {fm.tax_types.map((t) => (
          <Badge key={t} variant="outline">
            {t.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
      <Disclaimer lastVerified={fm.needs_verification ? null : fm.last_verified_at} className="my-6" />
      <div className="prose-guide">
        <MDXRemote source={guide.body} />
      </div>
    </article>
  );
}
