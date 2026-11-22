"use client";

/** Extracts plain text from a PDF, HTML or text file in the browser. */
export async function extractText(data: Blob, name = ""): Promise<string> {
  const type = data.type || (name.toLowerCase().endsWith(".pdf") ? "application/pdf" : name.toLowerCase().match(/\.html?$/) ? "text/html" : "text/plain");
  if (type.includes("pdf")) return extractPdf(await data.arrayBuffer());
  const text = await data.text();
  if (type.includes("html")) return htmlToText(text);
  return text;
}

async function extractPdf(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
  }
  await task.destroy();
  return pages.join("\n\n");
}

export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript,nav,header,footer").forEach((el) => el.remove());
  doc.querySelectorAll("br,p,div,li,h1,h2,h3,h4,h5,h6,tr").forEach((el) => el.append("\n"));
  return (doc.body?.textContent ?? "").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}
