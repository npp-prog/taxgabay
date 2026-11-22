import { describe, expect, it } from "vitest";
import {
  NO_ANSWER,
  buildRequest,
  chunkDocs,
  createRateLimiter,
  interpretResponse,
  questionTerms,
  retrieve,
  validateQuestion,
  type SourceDoc,
} from "./assistant-core";

const DOCS: SourceDoc[] = [
  {
    id: "rule:8pct",
    kind: "rule",
    title: "8% income tax option for individuals",
    href: "/calculators/income-tax",
    text: "8% income tax option for individuals. Available to non-VAT taxpayers whose gross sales do not exceed ₱3,000,000. Legal basis: RR 8-2018.",
    verified: true,
  },
  {
    id: "guide:2551q",
    kind: "guide",
    title: "BIR Form 2551Q — Quarterly Percentage Tax Return",
    href: "/guides/2551q",
    text: "Intro paragraph.\n\n## Who must file\n\nNon-VAT taxpayers not on the 8% option.\n\n## Deadline\n\nWithin 25 days after the end of each quarter.",
    verified: false,
  },
  { id: "glossary:rdo", kind: "glossary", title: "Glossary: RDO", href: "/learn/glossary#rdo", text: "RDO: Revenue District Office.", verified: true },
];
const CHUNKS = chunkDocs(DOCS);

describe("chunkDocs", () => {
  it("splits documents at ## headings and titles each chunk", () => {
    const g = CHUNKS.filter((c) => c.id === "guide:2551q");
    expect(g.map((c) => c.title)).toEqual([
      "BIR Form 2551Q — Quarterly Percentage Tax Return",
      "BIR Form 2551Q — Quarterly Percentage Tax Return — Who must file",
      "BIR Form 2551Q — Quarterly Percentage Tax Return — Deadline",
    ]);
    expect(new Set(CHUNKS.map((c) => c.chunkId)).size).toBe(CHUNKS.length);
  });
  it("caps chunk size by paragraphs", () => {
    const long = chunkDocs([{ ...DOCS[0]!, text: Array.from({ length: 10 }, (_, i) => `Paragraph ${i} ${"x".repeat(400)}`).join("\n\n") }]);
    expect(long.length).toBeGreaterThan(1);
    expect(long.every((c) => c.text.length <= 2300)).toBe(true);
  });
});

describe("retrieve", () => {
  it("drops question words", () => {
    expect(questionTerms("How much is the 8% option, po?")).toEqual(["8%", "option"]);
  });
  it("finds verified content and refuses when coverage is low", () => {
    const r = retrieve(CHUNKS, "Who can use the 8% option?", { allowUnverified: false });
    expect(r.chunks[0]!.id).toBe("rule:8pct");
    expect(r.chunks.every((c) => c.verified)).toBe(true);
    expect(retrieve(CHUNKS, "estate tax on a family home", { allowUnverified: true }).chunks).toEqual([]);
    expect(retrieve(CHUNKS, "how do i", { allowUnverified: true }).chunks).toEqual([]);
  });
  it("uses unverified content only when allowed", () => {
    expect(retrieve(CHUNKS, "2551Q deadline", { allowUnverified: false }).chunks).toEqual([]);
    const r = retrieve(CHUNKS, "2551Q deadline", { allowUnverified: true });
    expect(r.chunks[0]!.title).toMatch(/Deadline$/);
  });
});

describe("buildRequest", () => {
  it("sends each chunk as a cited document with its verification status", () => {
    const req = buildRequest("Who can use the 8% option?", CHUNKS.slice(0, 2));
    const content = req.messages[0]!.content as { type: string; citations?: { enabled: boolean }; context?: string; title?: string; text?: string }[];
    expect(content.filter((b) => b.type === "document")).toHaveLength(2);
    expect(content.every((b) => b.type !== "document" || b.citations?.enabled)).toBe(true);
    expect(content[0]!.context).toMatch(/^Verified/);
    expect(content.at(-1)).toEqual({ type: "text", text: "Question: Who can use the 8% option?" });
    expect(String(req.system)).toContain(NO_ANSWER);
  });
});

const cite = (document_index: number, cited_text: string) => ({ type: "char_location" as const, cited_text, document_index, document_title: null, start_char_index: 0, end_char_index: 1, file_id: null });

describe("interpretResponse", () => {
  const picked = [CHUNKS.find((c) => c.id === "rule:8pct")!, CHUNKS.find((c) => c.title.endsWith("Deadline"))!];

  it("numbers sources by first citation and flags unverified ones", () => {
    const r = interpretResponse(
      {
        stop_reason: "end_turn",
        content: [
          { type: "text", text: "You can use 8% if you are non-VAT", citations: [cite(0, "non-VAT taxpayers")] },
          { type: "text", text: " and file 2551Q within 25 days", citations: [cite(1, "Within 25 days"), cite(0, "₱3,000,000")] },
          { type: "text", text: ".", citations: null },
        ] as never,
      },
      picked,
    );
    expect(r.status).toBe("answered");
    if (r.status !== "answered") return;
    expect(r.segments.map((s) => s.sources)).toEqual([[1], [2, 1], []]);
    expect(r.sources.map((s) => [s.n, s.verified, s.quotes])).toEqual([
      [1, true, ["non-VAT taxpayers", "₱3,000,000"]],
      [2, false, ["Within 25 days"]],
    ]);
    expect(r.usedUnverified).toBe(true);
  });

  it("refuses on NO_ANSWER, missing citations, safety refusals and empty replies", () => {
    expect(interpretResponse({ stop_reason: "end_turn", content: [{ type: "text", text: NO_ANSWER, citations: null }] as never }, picked)).toMatchObject({ status: "refused", reason: "not_covered" });
    expect(interpretResponse({ stop_reason: "end_turn", content: [{ type: "text", text: "Sure, it is 5%.", citations: null }] as never }, picked)).toMatchObject({ status: "refused", reason: "uncited" });
    expect(interpretResponse({ stop_reason: "refusal", content: [] as never }, picked)).toMatchObject({ status: "refused", reason: "declined" });
    expect(interpretResponse({ stop_reason: "end_turn", content: [] as never }, picked)).toMatchObject({ status: "refused", reason: "not_covered" });
  });

  it("ignores citations pointing outside the documents sent", () => {
    const r = interpretResponse({ stop_reason: "end_turn", content: [{ type: "text", text: "x", citations: [cite(9, "x")] }] as never }, picked);
    expect(r).toMatchObject({ status: "refused", reason: "uncited" });
  });
});

describe("validation and rate limiting", () => {
  it("validates questions", () => {
    expect(validateQuestion(42)).toMatch(/words/);
    expect(validateQuestion(" a ")).toMatch(/too short/);
    expect(validateQuestion("x".repeat(501))).toMatch(/under 500/);
    expect(validateQuestion("What is VAT?")).toBeNull();
  });
  it("limits requests per key per window", () => {
    const allow = createRateLimiter(2, 1000);
    expect([allow("a", 0), allow("a", 10), allow("a", 20), allow("b", 20), allow("a", 1500)]).toEqual([true, true, false, true, true]);
  });
});

describe("retrieve: rare terms and synonyms", () => {
  const docs: SourceDoc[] = [
    { id: "rule:comp", kind: "rule", title: "Compromise penalty schedule", href: "/calculators", text: Array.from({ length: 12 }, (_, i) => `tax due over ${i}000: ${i}00`).join("; "), verified: true },
    { id: "guide:1701q", kind: "guide", title: "BIR Form 1701Q", href: "/guides/1701q", text: "Intro.\n\n## Deadline\n\nQ1: on or before 15 May.", verified: true },
    { id: "glossary:x", kind: "glossary", title: "Glossary: capital", href: "/learn/glossary", text: "Capital: money used in a business.", verified: true },
    ...Array.from({ length: 20 }, (_, i): SourceDoc => ({ id: `filler:${i}`, kind: "faq", title: `FAQ ${i}`, href: "/learn/faq", text: `Filler ${i} about registration and books.`, verified: true })),
  ];
  const chunks = chunkDocs(docs);
  it("a rare form number outranks a common word repeated many times", () => {
    expect(retrieve(chunks, "When is the 1701Q due?", { allowUnverified: false }).chunks[0]!.title).toBe("BIR Form 1701Q — Deadline");
  });
  it("matching only a common word in an unrelated question is not enough", () => {
    expect(retrieve(chunks, "What is the capital of France?", { allowUnverified: false }).chunks).toEqual([]);
  });
});
