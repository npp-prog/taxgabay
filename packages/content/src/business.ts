import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

/** Server-only: reads business guide MDX chapters from disk. */

export type BusinessCategory = "bookkeeping" | "payroll" | "lgu" | "statements";

export const BUSINESS_CATEGORIES: { key: BusinessCategory; label: string }[] = [
  { key: "bookkeeping", label: "Bookkeeping" },
  { key: "payroll", label: "Payroll and employees" },
  { key: "lgu", label: "LGU permits and local taxes" },
  { key: "statements", label: "Financial statements" },
];

export interface BusinessLink {
  label: string;
  href: string;
}

export interface BusinessFrontmatter {
  title: string;
  slug: string;
  category: BusinessCategory;
  summary: string;
  tax_types: string[];
  legal_basis: string[];
  related: BusinessLink[];
  last_verified_at: string | null;
  needs_verification: boolean;
  /** Reading order within the category (lower first); chapters without it sort last, by title. */
  order?: number;
}

export interface BusinessChapter {
  frontmatter: BusinessFrontmatter;
  body: string;
}

const REQUIRED: (keyof BusinessFrontmatter)[] = [
  "title", "slug", "category", "summary", "tax_types", "legal_basis", "related", "last_verified_at", "needs_verification",
];

export function businessDir(): string {
  return process.env.TAXGABAY_BUSINESS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "business");
}

export function parseBusinessChapter(source: string, file = "chapter"): BusinessChapter {
  const { data, content } = matter(source);
  for (const k of REQUIRED) {
    if (!(k in data)) throw new Error(`${file}: missing frontmatter "${k}"`);
  }
  if (!BUSINESS_CATEGORIES.some((c) => c.key === data.category)) throw new Error(`${file}: unknown category "${String(data.category)}"`);
  return { frontmatter: data as BusinessFrontmatter, body: content };
}

export function listBusinessChapters(dir = businessDir()): BusinessFrontmatter[] {
  return readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => parseBusinessChapter(readFileSync(/*turbopackIgnore: true*/ join(dir, f), "utf8"), f).frontmatter)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.title.localeCompare(b.title));
}

export function getBusinessChapter(slug: string, dir = businessDir()): BusinessChapter | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return parseBusinessChapter(readFileSync(/*turbopackIgnore: true*/ join(dir, `${slug}.mdx`), "utf8"), `${slug}.mdx`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
