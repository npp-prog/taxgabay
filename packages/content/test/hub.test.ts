import { describe, expect, it } from "vitest";
import { faqs } from "../src/faq";
import { glossary, glossarySlug } from "../src/glossary";
import { getHubArticle, listHubArticles, parseHubArticle } from "../src/hub";

describe("knowledge hub articles", () => {
  it("has the six articles with required frontmatter and a Legal basis section", () => {
    const list = listHubArticles();
    expect(list.map((a) => a.slug).sort()).toEqual(
      ["common-mistakes", "eight-percent-vs-graduated", "tax-basics", "tax-myths", "vat-vs-percentage-tax", "withholding-tax-explained"],
    );
    for (const fm of list) {
      const a = getHubArticle(fm.slug)!;
      expect(a.body).toContain("## Legal basis");
      expect(fm.needs_verification).toBe(true);
      expect(fm.last_verified_at).toBeNull();
      expect(fm.legal_basis.length).toBeGreaterThan(0);
      expect(fm.summary.length).toBeGreaterThan(10);
      for (const r of fm.related) expect(r.href.startsWith("/")).toBe(true);
    }
  });

  it("returns null for unknown or unsafe slugs", () => {
    expect(getHubArticle("nope")).toBeNull();
    expect(getHubArticle("../package")).toBeNull();
  });

  it("rejects bad frontmatter", () => {
    expect(() => parseHubArticle("---\ntitle: x\n---\nbody", "bad.mdx")).toThrow(/bad.mdx: missing frontmatter "slug"/);
    const fm = 'title: x\nslug: x\ncategory: other\nsummary: s\ntax_types: []\nlegal_basis: []\nrelated: []\nlast_verified_at: null\nneeds_verification: true';
    expect(() => parseHubArticle(`---\n${fm}\n---\n`, "cat.mdx")).toThrow(/unknown category/);
  });
});

describe("glossary", () => {
  it("is sorted, unique and links internally", () => {
    const names = glossary.map((g) => g.term);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(names.map(glossarySlug)).size).toBe(names.length);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true }));
    expect(names).toEqual(sorted);
    expect(glossary.length).toBeGreaterThanOrEqual(30);
    for (const g of glossary) for (const s of g.see ?? []) expect(s.href.startsWith("/")).toBe(true);
  });
});

describe("faqs", () => {
  it("has unique ids and internal links", () => {
    const ids = faqs.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(faqs.length).toBeGreaterThanOrEqual(12);
    for (const f of faqs) for (const s of f.see ?? []) expect(s.href.startsWith("/")).toBe(true);
  });
});
