// Copies the pdf.js worker into public/ so the ingestion tool can load it at /pdfjs/pdf.worker.min.mjs.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("pdfjs-dist/package.json")), "build", "pdf.worker.min.mjs");
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pdfjs");
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, "pdf.worker.min.mjs"));
