import { peso, type Step } from "@taxgabay/tax-engine";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "keyValue"; rows: [string, string][] }
  | { kind: "table"; columns: { label: string; width: number; align?: "left" | "right" }[]; rows: string[][] }
  | { kind: "checklist"; items: { text: string; done: boolean; note?: string }[] };

export interface PdfDoc {
  title: string;
  subtitle?: string;
  generatedOn: string;
  blocks: PdfBlock[];
  /** Large diagonal text on every page, e.g. "DRAFT — NOT REVIEWED". */
  watermark?: string;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_SPACE = 28;
const BODY = 10;
const SMALL = 8;
const LINE = 1.35;
const MUTED = rgb(0.35, 0.38, 0.45);
const BLACK = rgb(0.06, 0.09, 0.16);
const RULE = rgb(0.85, 0.87, 0.9);

const TRANSLIT: [RegExp, string][] = [
  [/₱\s?/g, "PHP "],
  [/−/g, "-"],
  [/≤/g, "<="],
  [/≥/g, ">="],
  [/≠/g, "!="],
  [/→/g, "->"],
  [/←/g, "<-"],
  [/\u00a0/g, " "],
];

const charsetCache = new WeakMap<PDFFont, Set<number>>();

/** Makes text encodable by a standard font: transliterates common symbols, replaces the rest with "?". */
export function pdfSafe(text: string, font: PDFFont): string {
  let s = text;
  for (const [re, rep] of TRANSLIT) s = s.replace(re, rep);
  let set = charsetCache.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    charsetCache.set(font, set);
  }
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    out += ch === "\n" || set.has(cp) ? ch : "?";
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of pdfSafe(text, font).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width) {
        cur = next;
        continue;
      }
      if (cur) lines.push(cur);
      // Break words longer than the line.
      let word = w;
      while (font.widthOfTextAtSize(word, size) > width && word.length > 1) {
        let i = word.length - 1;
        while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > width) i--;
        lines.push(word.slice(0, i));
        word = word.slice(i);
      }
      cur = word;
    }
    lines.push(cur);
  }
  return lines;
}

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

/** Ensures `h` points of vertical space, starting a new page if needed. Returns true if a page break happened. */
function ensure(ctx: Ctx, h: number): boolean {
  if (ctx.y - h < MARGIN + FOOTER_SPACE) {
    newPage(ctx);
    return true;
  }
  return false;
}

function drawLines(ctx: Ctx, lines: string[], x: number, font: PDFFont, size: number, color = BLACK) {
  for (const l of lines) {
    ensure(ctx, size * LINE);
    ctx.page.drawText(l, { x, y: ctx.y - size, size, font, color });
    ctx.y -= size * LINE;
  }
}

function drawTable(ctx: Ctx, block: Extract<PdfBlock, { kind: "table" }>) {
  const total = block.columns.reduce((a, c) => a + c.width, 0) || 1;
  const widths = block.columns.map((c) => (c.width / total) * CONTENT_W);
  const pad = 4;
  const drawRow = (cells: string[], font: PDFFont, size: number) => {
    const wrapped = cells.map((c, i) => wrap(c ?? "", font, size, widths[i]! - pad * 2));
    const h = Math.max(...wrapped.map((w) => w.length)) * size * LINE + pad;
    return { wrapped, h };
  };
  const header = () => {
    const { wrapped, h } = drawRow(block.columns.map((c) => c.label), ctx.bold, SMALL);
    paint(wrapped, h, ctx.bold, SMALL, MUTED);
  };
  const paint = (wrapped: string[][], h: number, font: PDFFont, size: number, color = BLACK) => {
    let x = MARGIN;
    wrapped.forEach((lines, i) => {
      const col = block.columns[i]!;
      lines.forEach((l, li) => {
        const tw = font.widthOfTextAtSize(l, size);
        const tx = col.align === "right" ? x + widths[i]! - pad - tw : x + pad;
        ctx.page.drawText(l, { x: tx, y: ctx.y - size - li * size * LINE, size, font, color });
      });
      x += widths[i]!;
    });
    ctx.y -= h;
    ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y + 1 }, end: { x: MARGIN + CONTENT_W, y: ctx.y + 1 }, thickness: 0.5, color: RULE });
    ctx.y -= 2;
  };
  ensure(ctx, SMALL * LINE * 3);
  header();
  for (const row of block.rows) {
    const { wrapped, h } = drawRow(row, ctx.font, SMALL + 1);
    if (ensure(ctx, h)) header();
    paint(wrapped, h, ctx.font, SMALL + 1);
  }
  ctx.y -= 6;
}

export async function buildPdf(doc: PdfDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafeAscii(doc.title));
  pdf.setProducer("TaxGabay");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { pdf, page: pdf.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN, font, bold };

  drawLines(ctx, wrap(doc.title, bold, 18, CONTENT_W), MARGIN, bold, 18);
  if (doc.subtitle) drawLines(ctx, wrap(doc.subtitle, font, BODY + 1, CONTENT_W), MARGIN, font, BODY + 1, MUTED);
  drawLines(ctx, wrap(`Generated on ${doc.generatedOn}`, font, SMALL, CONTENT_W), MARGIN, font, SMALL, MUTED);
  ctx.y -= 10;

  for (const b of doc.blocks) {
    switch (b.kind) {
      case "heading":
        ensure(ctx, 40);
        ctx.y -= 4;
        drawLines(ctx, wrap(b.text, bold, 12, CONTENT_W), MARGIN, bold, 12);
        ctx.y -= 2;
        break;
      case "paragraph":
        drawLines(ctx, wrap(b.text, font, BODY, CONTENT_W), MARGIN, font, BODY);
        ctx.y -= 4;
        break;
      case "keyValue": {
        const kw = CONTENT_W * 0.4;
        for (const [k, v] of b.rows) {
          const kl = wrap(k, bold, BODY, kw - 8);
          const vl = wrap(v, font, BODY, CONTENT_W - kw);
          const h = Math.max(kl.length, vl.length) * BODY * LINE;
          ensure(ctx, h);
          kl.forEach((l, i) => ctx.page.drawText(l, { x: MARGIN, y: ctx.y - BODY - i * BODY * LINE, size: BODY, font: bold, color: BLACK }));
          vl.forEach((l, i) => ctx.page.drawText(l, { x: MARGIN + kw, y: ctx.y - BODY - i * BODY * LINE, size: BODY, font, color: BLACK }));
          ctx.y -= h + 2;
        }
        ctx.y -= 4;
        break;
      }
      case "table":
        drawTable(ctx, b);
        break;
      case "checklist":
        for (const it of b.items) {
          const tl = wrap(it.text, bold, BODY, CONTENT_W - 18);
          const nl = it.note ? wrap(it.note, font, SMALL, CONTENT_W - 18) : [];
          ensure(ctx, tl.length * BODY * LINE + nl.length * SMALL * LINE + 4);
          const boxY = ctx.y - BODY;
          ctx.page.drawRectangle({ x: MARGIN, y: boxY, width: 9, height: 9, borderColor: BLACK, borderWidth: 0.8 });
          if (it.done) {
            ctx.page.drawLine({ start: { x: MARGIN + 1.5, y: boxY + 4.5 }, end: { x: MARGIN + 3.8, y: boxY + 1.5 }, thickness: 1.2, color: BLACK });
            ctx.page.drawLine({ start: { x: MARGIN + 3.8, y: boxY + 1.5 }, end: { x: MARGIN + 8, y: boxY + 8 }, thickness: 1.2, color: BLACK });
          }
          drawLines(ctx, tl, MARGIN + 18, bold, BODY);
          if (nl.length) drawLines(ctx, nl, MARGIN + 18, font, SMALL, MUTED);
          ctx.y -= 4;
        }
        break;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    if (doc.watermark) {
      const w = pdfSafe(doc.watermark, bold);
      const size = 42;
      const tw = bold.widthOfTextAtSize(w, size);
      p.drawText(w, { x: PAGE_W / 2 - (tw / 2) * Math.cos(Math.PI / 6), y: PAGE_H / 2 - (tw / 2) * Math.sin(Math.PI / 6), size, font: bold, color: rgb(0.85, 0.2, 0.15), opacity: 0.14, rotate: degrees(30) });
    }
    const text = pdfSafe(`TaxGabay · For guidance only. Verify with BIR issuances or consult a CPA. · Page ${i + 1} of ${pages.length}`, font);
    p.drawText(text, { x: MARGIN, y: MARGIN / 2, size: 7, font, color: MUTED });
  });
  return pdf.save();
}

function pdfSafeAscii(s: string): string {
  return s.replace(/₱\s?/g, "PHP ").replace(/[^\x20-\x7e]/g, "-");
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function stepsToTable(steps: readonly Step[]): PdfBlock {
  return {
    kind: "table",
    columns: [
      { label: "Step", width: 0.38 },
      { label: "Formula", width: 0.42 },
      { label: "Amount", width: 0.2, align: "right" },
    ],
    rows: steps.map((s) => [s.legal_basis ? `${s.label}\nBasis: ${s.legal_basis}` : s.label, s.formula, peso(s.amount)]),
  };
}

export function slugifyFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "taxgabay"
  ) + ".pdf";
}
