import { describe, expect, it } from "vitest";
import { BUSINESS_CATEGORIES, getBusinessChapter, listBusinessChapters, parseBusinessChapter } from "../src/business";

const EXPECTED: Record<string, string[]> = {
  bookkeeping: ["bank-reconciliation", "books-of-accounts", "chart-of-accounts", "invoices-and-receipts"],
  payroll: ["employer-filings", "hiring-employees", "payroll-basics"],
  lgu: ["business-permits-and-renewal", "local-business-tax"],
  statements: ["audited-financial-statements", "reading-financial-statements"],
};

describe("business guide chapters", () => {
  const list = listBusinessChapters();

  it("has every planned chapter in the right category", () => {
    for (const c of BUSINESS_CATEGORIES) {
      expect(list.filter((a) => a.category === c.key).map((a) => a.slug).sort()).toEqual(EXPECTED[c.key]);
    }
    expect(list).toHaveLength(11);
  });

  it("has required frontmatter, a Legal basis section and internal links only", () => {
    for (const fm of list) {
      const a = getBusinessChapter(fm.slug)!;
      expect(a.body).toContain("## Legal basis");
      expect(fm.needs_verification).toBe(true);
      expect(fm.last_verified_at).toBeNull();
      expect(fm.legal_basis.length).toBeGreaterThan(0);
      expect(fm.summary.length).toBeGreaterThan(10);
      expect(fm.related.length).toBeGreaterThan(0);
      for (const r of fm.related) expect(r.href).toMatch(/^\/(?!\/)/);
      expect(a.body).not.toMatch(/\]\(https?:/);
    }
  });

  it("links bookkeeping chapters to the practice sets", () => {
    expect(list.some((fm) => fm.related.some((r) => r.href === "/practice"))).toBe(true);
  });

  it("returns null for unknown or unsafe slugs", () => {
    expect(getBusinessChapter("nope")).toBeNull();
    expect(getBusinessChapter("../package")).toBeNull();
    expect(getBusinessChapter("Books-Of-Accounts")).toBeNull();
  });

  it("rejects bad frontmatter", () => {
    expect(() => parseBusinessChapter("---\ntitle: x\n---\nbody", "bad.mdx")).toThrow(/bad.mdx: missing frontmatter "slug"/);
    const fm = "title: x\nslug: x\ncategory: tax\nsummary: s\ntax_types: []\nlegal_basis: []\nrelated: []\nlast_verified_at: null\nneeds_verification: true";
    expect(() => parseBusinessChapter(`---\n${fm}\n---\n`, "cat.mdx")).toThrow(/unknown category/);
  });
});
