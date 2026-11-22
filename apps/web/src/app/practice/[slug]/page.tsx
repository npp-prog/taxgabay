import { getPracticeSet, practiceSets } from "@taxgabay/accounting";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PracticeView } from "./practice-view";

export function generateStaticParams() {
  return practiceSets.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const set = getPracticeSet((await params).slug);
  return { title: set ? `${set.title} — practice set` : "Practice set" };
}

export default async function PracticeSetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getPracticeSet(slug)) notFound();
  return <PracticeView slug={slug} />;
}
