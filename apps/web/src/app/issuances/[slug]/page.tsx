import { seedIssuances } from "@taxgabay/content/issuances";
import type { Metadata } from "next";
import { IssuanceDetail } from "./detail";

// Bundled issuances are prerendered; database issuances render on demand.
export function generateStaticParams() {
  return seedIssuances.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const seed = seedIssuances.find((i) => i.slug === slug);
  return { title: seed ? `${seed.type} ${seed.number}` : "Issuance" };
}

export default async function IssuancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <IssuanceDetail slug={slug} />;
}
