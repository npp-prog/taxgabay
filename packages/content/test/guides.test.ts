import { describe, expect, it } from "vitest";
import { getGuide, listGuides, parseGuide } from "../src";

const FORMS = ["0619E", "1601C", "1601EQ", "1604C", "1604E", "1701", "1701A", "1701Q", "1702-RT", "1702Q", "1706", "1707", "1800", "1801", "1905", "2000-OT", "2550Q", "2551Q"];
const SECTIONS = ["Who must file", "Deadline", "Where to file and pay", "Attachments", "Field-by-field walkthrough", "Common mistakes", "Related calculators", "Legal basis"];

describe("filing guides", () => {
  it("has one guide per covered form", () => {
    expect(listGuides().map((g) => g.form)).toEqual(FORMS);
  });

  it("every guide has all required sections and is flagged for verification", () => {
    for (const fm of listGuides()) {
      const g = getGuide(fm.slug)!;
      for (const s of SECTIONS) expect(g.body, `${fm.slug}: ${s}`).toContain(`## ${s}`);
      expect(fm.needs_verification).toBe(true);
      expect(fm.legal_basis.length).toBeGreaterThan(0);
      expect(fm.slug).toBe(fm.form.toLowerCase());
    }
  });

  it("returns null for unknown or unsafe slugs", () => {
    expect(getGuide("nope")).toBeNull();
    expect(getGuide("../package")).toBeNull();
  });

  it("rejects guides with missing frontmatter", () => {
    expect(() => parseGuide("---\ntitle: x\n---\nbody", "bad.mdx")).toThrow(/bad.mdx: missing frontmatter "form"/);
  });
});
