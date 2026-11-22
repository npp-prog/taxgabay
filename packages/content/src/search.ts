/** Pure, dependency-free text search used by the issuances library and site search. */

const STOP = new Set(["the", "a", "an", "of", "and", "or", "to", "for", "in", "on", "no", "ng", "sa", "at", "is", "ang"]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‐-―]/g, "-");
}

/** Lowercase tokens; keeps "8-2018"-style numbers together. */
export function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9%₱-]+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 0 && !STOP.has(t));
}

export interface SearchField {
  text: string;
  weight: number;
}

/**
 * Score a document for a query: every query token must prefix-match a token in some
 * field (AND semantics). Exact token matches score double. Returns 0 for no match.
 */
export function scoreFields(query: string, fields: readonly SearchField[]): number {
  const q = tokenize(query);
  if (q.length === 0) return 0;
  const fieldTokens = fields.map((f) => ({ tokens: tokenize(f.text), weight: f.weight }));
  let total = 0;
  for (const qt of q) {
    let best = 0;
    for (const f of fieldTokens) {
      for (const t of f.tokens) {
        if (t === qt) best = Math.max(best, f.weight * 2);
        else if (t.startsWith(qt)) best = Math.max(best, f.weight);
      }
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

/** Short excerpt around the first query hit. */
export function snippet(text: string, query: string, radius = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const lower = normalize(flat);
  let at = -1;
  for (const t of tokenize(query)) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return flat.slice(0, radius * 2) + (flat.length > radius * 2 ? "…" : "");
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

// ---------- Site search ----------

export type SearchKind = "guide" | "article" | "glossary" | "faq" | "issuance" | "life_event" | "calculator";

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  title: string;
  href: string;
  text: string;
  keywords?: string[];
}

export interface SearchHit extends SearchDoc {
  score: number;
  excerpt: string;
}

export function searchDocs(docs: readonly SearchDoc[], query: string, opts: { kinds?: SearchKind[]; limit?: number } = {}): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const d of docs) {
    if (opts.kinds && !opts.kinds.includes(d.kind)) continue;
    const score = scoreFields(query, [
      { text: d.title, weight: 3 },
      { text: (d.keywords ?? []).join(" "), weight: 2 },
      { text: d.text, weight: 1 },
    ]);
    if (score > 0) hits.push({ ...d, score, excerpt: snippet(d.text, query) });
  }
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return opts.limit ? hits.slice(0, opts.limit) : hits;
}

/** Plain text from markdown/MDX, for indexing. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
