import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

/** Server-only: reads MDX guides from disk. */

export interface GuideFrontmatter {
  title: string;
  form: string;
  slug: string;
  tax_types: string[];
  forms: string[];
  related_calculators: string[];
  legal_basis: string[];
  last_verified_at: string | null;
  needs_verification: boolean;
  status: "skeleton" | "draft" | "published";
}

export interface Guide {
  frontmatter: GuideFrontmatter;
  body: string;
}

const REQUIRED: (keyof GuideFrontmatter)[] = [
  "title", "form", "slug", "tax_types", "forms", "related_calculators", "legal_basis", "last_verified_at", "needs_verification", "status",
];

export function guidesDir(): string {
  return process.env.TAXGABAY_GUIDES_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "guides");
}

export function parseGuide(source: string, file = "guide"): Guide {
  const { data, content } = matter(source);
  for (const k of REQUIRED) {
    if (!(k in data)) throw new Error(`${file}: missing frontmatter "${k}"`);
  }
  return { frontmatter: data as GuideFrontmatter, body: content };
}

export function listGuides(dir = guidesDir()): GuideFrontmatter[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => parseGuide(readFileSync(join(dir, f), "utf8"), f).frontmatter)
    .sort((a, b) => a.form.localeCompare(b.form));
}

export function getGuide(slug: string, dir = guidesDir()): Guide | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return parseGuide(readFileSync(join(dir, `${slug}.mdx`), "utf8"), `${slug}.mdx`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
