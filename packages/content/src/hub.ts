import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

/** Server-only: reads knowledge hub MDX articles from disk. */

export type HubCategory = "basics" | "tax-types" | "common-mistakes" | "myths";

export const HUB_CATEGORIES: { key: HubCategory; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "tax-types", label: "Tax types" },
  { key: "common-mistakes", label: "Common mistakes" },
  { key: "myths", label: "Myths" },
];

export interface HubLink {
  label: string;
  href: string;
}

export interface HubFrontmatter {
  title: string;
  slug: string;
  category: HubCategory;
  summary: string;
  tax_types: string[];
  legal_basis: string[];
  related: HubLink[];
  last_verified_at: string | null;
  needs_verification: boolean;
}

export interface HubArticle {
  frontmatter: HubFrontmatter;
  body: string;
}

const REQUIRED: (keyof HubFrontmatter)[] = [
  "title", "slug", "category", "summary", "tax_types", "legal_basis", "related", "last_verified_at", "needs_verification",
];

export function hubDir(): string {
  return process.env.TAXGABAY_HUB_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "hub");
}

export function parseHubArticle(source: string, file = "article"): HubArticle {
  const { data, content } = matter(source);
  for (const k of REQUIRED) {
    if (!(k in data)) throw new Error(`${file}: missing frontmatter "${k}"`);
  }
  if (!HUB_CATEGORIES.some((c) => c.key === data.category)) throw new Error(`${file}: unknown category "${String(data.category)}"`);
  return { frontmatter: data as HubFrontmatter, body: content };
}

export function listHubArticles(dir = hubDir()): HubFrontmatter[] {
  return readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => parseHubArticle(readFileSync(/*turbopackIgnore: true*/ join(dir, f), "utf8"), f).frontmatter)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getHubArticle(slug: string, dir = hubDir()): HubArticle | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return parseHubArticle(readFileSync(/*turbopackIgnore: true*/ join(dir, `${slug}.mdx`), "utf8"), `${slug}.mdx`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
