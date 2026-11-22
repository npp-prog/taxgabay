import { describe, expect, it } from "vitest";
import { draftIssuanceFromText, isAllowedSourceUrl } from "../src/ingest";
import {
  canTransition,
  facetValues,
  filterIssuances,
  issuanceLabel,
  issuanceSlug,
  issuanceYear,
  relatedIssuances,
  reviewBlockers,
  seedIssuanceLinks,
  seedIssuances,
  validateIssuance,
} from "../src/issuances";
import { normalize, scoreFields, searchDocs, snippet, stripMarkdown, tokenize, type SearchDoc } from "../src/search";

describe("search primitives", () => {
  it("tokenizes, keeping issuance numbers together", () => {
    expect(tokenize("RR No. 8-2018 on the 8% option")).toEqual(["rr", "8-2018", "8%", "option"]);
    expect(normalize("Café – x")).toBe("cafe - x");
  });
  it("scores with AND semantics and prefix matches", () => {
    expect(scoreFields("vat thresh", [{ text: "VAT threshold", weight: 1 }])).toBe(3);
    expect(scoreFields("vat estate", [{ text: "VAT threshold", weight: 1 }])).toBe(0);
    expect(scoreFields("  ", [{ text: "x", weight: 1 }])).toBe(0);
  });
  it("builds snippets and strips markdown", () => {
    expect(snippet("a ".repeat(100) + "needle here", "needle", 20)).toMatch(/^….*needle here$/);
    expect(snippet("short text", "zzz")).toBe("short text");
    expect(snippet("x".repeat(200), "zzz", 10)).toMatch(/…$/);
    expect(stripMarkdown("## Hi [link](/x) **bold**\n```js\ncode\n```<b>t</b>")).toBe("Hi link bold t");
  });
  it("searches documents with kind filter and limit", () => {
    const docs: SearchDoc[] = [
      { id: "1", kind: "guide", title: "2551Q percentage tax", href: "/g", text: "quarterly" },
      { id: "2", kind: "article", title: "VAT vs percentage tax", href: "/a", text: "compare", keywords: ["2551Q"] },
      { id: "3", kind: "faq", title: "Other", href: "/f", text: "nothing" },
    ];
    expect(searchDocs(docs, "percentage").map((d) => d.id)).toEqual(["1", "2"]);
    expect(searchDocs(docs, "percentage", { kinds: ["article"] }).map((d) => d.id)).toEqual(["2"]);
    expect(searchDocs(docs, "2551q", { limit: 1 }).map((d) => d.id)).toEqual(["1"]);
  });
});

describe("issuances", () => {
  it("builds slugs and labels", () => {
    expect(issuanceSlug("RR", "8-2018")).toBe("rr-8-2018");
    expect(issuanceSlug("BIR Ruling", "OT-123-2024")).toBe("bir-ruling-ot-123-2024");
    expect(issuanceLabel({ type: "RA", number: "11976" })).toBe("RA 11976");
  });
  it("has unique seed slugs, all flagged, and links that resolve", () => {
    const slugs = new Set(seedIssuances.map((i) => i.slug));
    expect(slugs.size).toBe(seedIssuances.length);
    expect(seedIssuances.every((i) => i.needs_verification)).toBe(true);
    for (const l of seedIssuanceLinks) {
      expect(slugs.has(l.from_slug)).toBe(true);
      expect(slugs.has(l.to_slug)).toBe(true);
    }
  });
  it("derives the year from the date or the number", () => {
    expect(issuanceYear({ number: "8-2018", date_issued: null })).toBe(2018);
    expect(issuanceYear({ number: "10963", date_issued: "2017-12-19" })).toBe(2017);
    expect(issuanceYear({ number: "12066", date_issued: null })).toBeNull();
  });
  it("filters and searches", () => {
    expect(filterIssuances(seedIssuances, { q: "rr 8-2018" })[0]!.slug).toBe("rr-8-2018");
    expect(filterIssuances(seedIssuances, { q: "ease of paying" })[0]!.slug).toBe("ra-11976");
    expect(filterIssuances(seedIssuances, { type: "RA" }).every((i) => i.type === "RA")).toBe(true);
    expect(filterIssuances(seedIssuances, { year: 2024 }).map((i) => i.slug)).toEqual(expect.arrayContaining(["ra-11976", "rr-7-2024"]));
    expect(filterIssuances(seedIssuances, { tax_type: "estate_tax" }).map((i) => i.slug)).toEqual(["ra-10963"]);
    expect(filterIssuances(seedIssuances, { topic: "INVOICING" }).map((i) => i.slug).sort()).toEqual(["ra-11976", "rr-7-2024"]);
    expect(filterIssuances(seedIssuances, { status: "revoked" })).toEqual([]);
    expect(filterIssuances(seedIssuances, { q: "zzzz" })).toEqual([]);
    expect(filterIssuances(seedIssuances, {})).toHaveLength(seedIssuances.length);
  });
  it("lists facet values", () => {
    const f = facetValues(seedIssuances);
    expect(f.types).toEqual(["RR", "RMO", "RA"]);
    expect(f.years[0]).toBe(2024);
    expect(f.taxTypes).toContain("vat");
  });
  it("lists related issuances both ways", () => {
    const r = relatedIssuances("ra-11976", seedIssuanceLinks, seedIssuances);
    expect(r.map((x) => `${x.label} ${x.slug}`)).toEqual(["Implemented by rr-6-2024", "Implemented by rr-7-2024", "Implemented by rr-8-2024"]);
    const r2 = relatedIssuances("rr-11-2018", seedIssuanceLinks, seedIssuances);
    expect(r2.map((x) => x.label)).toEqual(["Amends", "Implements"]);
    expect(relatedIssuances("x", [{ from_slug: "x", to_slug: "missing", relation: "clarifies" }], seedIssuances)[0]!.issuance).toBeNull();
  });
  it("enforces the workflow and validation", () => {
    expect(canTransition("draft", "reviewed")).toBe(true);
    expect(canTransition("draft", "published")).toBe(false);
    expect(canTransition("reviewed", "published")).toBe(true);
    expect(canTransition("published", "draft")).toBe(true);
    expect(canTransition("published", "reviewed")).toBe(false);
    expect(validateIssuance({})).toHaveLength(3);
    expect(validateIssuance({ type: "RR", number: "1-2026", title: "t", date_issued: "2026/01/01", source_url: "http://x" })).toEqual([
      "Date issued must be a date.",
      "The source link must start with https://.",
    ]);
    expect(reviewBlockers({ type: "RR", number: "1-2026", title: "t" })).toEqual([
      "Write the plain-language summary.",
      "Add the link to the official source.",
      "Tag at least one tax type.",
    ]);
  });
});

// Synthetic sample texts (not real issuances) shaped like BIR documents.
const SAMPLE_RR = `
REPUBLIC OF THE PHILIPPINES
DEPARTMENT OF FINANCE
BUREAU OF INTERNAL REVENUE

March 3, 2031

REVENUE REGULATIONS NO. 99 - 2031

SUBJECT: Amending Certain Provisions of Revenue Regulations No. 2-98, as Amended,
on Expanded Withholding Tax

TO: All Internal Revenue Officers and Others Concerned

SECTION 1. These Regulations implement Republic Act No. 11976 and further amend RR 11-2018.
Creditable withholding tax shall apply to income payments. The value-added tax shall not form part of the base.
Section 9 of RMC No. 5-2030 is hereby revoked.
`;

const SAMPLE_RMC = `
REVENUE MEMORANDUM CIRCULAR NO. 12-2031
ISSUED: January 15, 2031
Clarifying the extension of the deadline for filing of returns via eFPS and eBIRForms
This Circular clarifies RR 99-2031 on income tax returns.
`;

describe("draftIssuanceFromText", () => {
  it("drafts an RR with subject, date, tax types and references", () => {
    const d = draftIssuanceFromText(SAMPLE_RR, "https://www.bir.gov.ph/x.pdf");
    expect(d.type).toBe("RR");
    expect(d.number).toBe("99-2031");
    expect(d.date_issued).toBe("2031-03-03");
    expect(d.title).toBe("Amending Certain Provisions of Revenue Regulations No. 2-98, as Amended, on Expanded Withholding Tax");
    expect(d.tax_types).toEqual(expect.arrayContaining(["withholding_expanded", "vat"]));
    const refs = Object.fromEntries(d.references.map((r) => [r.slug, r.relation_guess]));
    expect(refs).toMatchObject({ "rr-2-98": "amends", "ra-11976": "implements", "rr-11-2018": "amends", "rmc-5-2030": "revokes" });
    expect(refs["rr-99-2031"]).toBeUndefined();
    expect(d.source_url).toBe("https://www.bir.gov.ph/x.pdf");
  });
  it("drafts an RMC without a SUBJECT line", () => {
    const d = draftIssuanceFromText(SAMPLE_RMC);
    expect(d).toMatchObject({ type: "RMC", number: "12-2031", date_issued: "2031-01-15" });
    expect(d.title).toMatch(/^Clarifying the extension/);
    expect(d.topics).toEqual(expect.arrayContaining(["deadline extension", "e-filing"]));
    expect(d.references).toEqual([{ type: "RR", number: "99-2031", slug: "rr-99-2031", relation_guess: "clarifies" }]);
  });
  it("recognizes other headers", () => {
    expect(draftIssuanceFromText("REPUBLIC ACT NO. 99999\nAN ACT doing something important here").number).toBe("99999");
    expect(draftIssuanceFromText("REVENUE ADMINISTRATIVE MEMORANDUM ORDER NO. 3-2031").type).toBe("RAMO");
    expect(draftIssuanceFromText("REVENUE MEMORANDUM ORDER NO. 4-2031").type).toBe("RMO");
    expect(draftIssuanceFromText("BIR RULING NO. OT-123-2031").number).toBe("OT-123-2031");
  });
  it("explains what it could not find", () => {
    const d = draftIssuanceFromText("nothing useful");
    expect(d.type).toBeNull();
    expect(d.notes.join(" ")).toMatch(/type and number.*date issued.*title/);
  });
  it("allow-lists government source URLs", () => {
    expect(isAllowedSourceUrl("https://www.bir.gov.ph/images/rr.pdf")).toBe(true);
    expect(isAllowedSourceUrl("https://bir.gov.ph/a")).toBe(true);
    expect(isAllowedSourceUrl("https://www.officialgazette.gov.ph/x")).toBe(true);
    expect(isAllowedSourceUrl("http://www.bir.gov.ph/a")).toBe(false);
    expect(isAllowedSourceUrl("https://evil.com/bir.gov.ph")).toBe(false);
    expect(isAllowedSourceUrl("https://bir.gov.ph.evil.com/")).toBe(false);
    expect(isAllowedSourceUrl("https://user:pw@bir.gov.ph/")).toBe(false);
    expect(isAllowedSourceUrl("https://bir.gov.ph:8443/")).toBe(false);
    expect(isAllowedSourceUrl("not a url")).toBe(false);
  });
});

describe("relation after a reference", () => {
  it("reads 'is hereby amended/clarified' after the reference", () => {
    const d = draftIssuanceFromText("REVENUE REGULATIONS NO. 1-2031\nJanuary 2, 2031\nSUBJECT: Test\n\nSection 2 of RR 3-2030 is hereby modified. RMC 4-2030 is hereby clarified.");
    const refs = Object.fromEntries(d.references.map((r) => [r.slug, r.relation_guess]));
    expect(refs).toEqual({ "rr-3-2030": "amends", "rmc-4-2030": "clarifies" });
  });
});
