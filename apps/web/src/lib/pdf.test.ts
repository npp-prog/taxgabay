import { inflateSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildPdf, pdfSafe, slugifyFilename, stepsToTable } from "./pdf";

const doc = (rows: number) => ({
  title: "Income tax: 8% vs graduated rates",
  subtitle: "Computed on 2026-11-22",
  generatedOn: "2026-11-22",
  blocks: [
    { kind: "heading" as const, text: "Inputs" },
    { kind: "keyValue" as const, rows: [["Gross sales", "₱1,000,000.00"]] as [string, string][] },
    { kind: "paragraph" as const, text: "Lowest total tax: ₱60,000.00 — a very long paragraph ".repeat(20) },
    {
      kind: "table" as const,
      columns: [
        { label: "Step", width: 0.5 },
        { label: "Amount", width: 0.5, align: "right" as const },
      ],
      rows: Array.from({ length: rows }, (_, i) => [`Row ${i} with some wrapping text that is long enough to wrap onto a second line maybe`, "₱1.00"]),
    },
    { kind: "checklist" as const, items: [{ text: "Register with DTI", done: true, note: "DTI · online" }, { text: "BIR", done: false }] },
  ],
});

describe("buildPdf", () => {
  it("produces a loadable PDF", async () => {
    const bytes = await buildPdf(doc(3));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    expect(loaded.getTitle()).toBe("Income tax: 8% vs graduated rates");
  });

  it("breaks long tables across pages", async () => {
    const bytes = await buildPdf(doc(120));
    const loaded = await PDFDocument.load(bytes);
    const n = loaded.getPageCount();
    expect(n).toBeGreaterThan(1);
    // Inflate every stream and search the decoded page content for the footer text.
    const buf = Buffer.from(bytes);
    let raw = "";
    let at = 0;
    for (;;) {
      const start = buf.indexOf("stream", at);
      if (start < 0) break;
      const dataStart = buf[start + 6] === 0x0d ? start + 8 : start + 7;
      const end = buf.indexOf("endstream", dataStart);
      try {
        raw += inflateSync(buf.subarray(dataStart, end)).toString("latin1");
      } catch {
        /* not a flate stream */
      }
      at = end + 9;
    }
    raw = raw.toUpperCase();
    const hex = (t: string) => [...t].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("").toUpperCase();
    expect(raw).toContain(hex(`Page ${n} of ${n}`));
    expect(raw).toContain(hex(`Page 1 of ${n}`));
  });
});

describe("pdfSafe", () => {
  it("transliterates and replaces unencodable characters", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    expect(pdfSafe("₱1,000 − ₱500 ≤ x ≥ y → 汉", font)).toBe("PHP 1,000 - PHP 500 <= x >= y -> ?");
    expect(pdfSafe("Tax × 2 — “ok”", font)).toBe("Tax × 2 — “ok”");
  });
});

describe("helpers", () => {
  it("builds a steps table with legal basis under the label", () => {
    const t = stepsToTable([{ label: "VAT", formula: "12% × ₱100.00", amount: "12.00", legal_basis: "NIRC Sec. 106" }]);
    expect(t).toMatchObject({ kind: "table", rows: [["VAT\nBasis: NIRC Sec. 106", "12% × ₱100.00", "₱12.00"]] });
  });
  it("slugifies filenames", () => {
    expect(slugifyFilename("Income tax: 8% vs graduated")).toBe("income-tax-8-vs-graduated.pdf");
    expect(slugifyFilename("₱₱")).toBe("taxgabay.pdf");
  });
});
