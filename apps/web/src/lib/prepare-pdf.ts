import type { ClientInfo, Packet, PreparedDocument } from "@taxgabay/filing";
import { peso } from "@taxgabay/tax-engine";
import { stepsToTable, type PdfBlock, type PdfDoc } from "./pdf";

export const REVIEWER = "Neil Priolo, CPA";
const DRAFT = "DRAFT - NOT REVIEWED";

function documentBlocks(d: PreparedDocument): PdfBlock[] {
  const blocks: PdfBlock[] = [{ kind: "heading", text: `${d.form} — ${d.title}` }];
  const kv: [string, string][] = [["Period", d.period_label]];
  if (d.due_date) kv.push(["Due date", d.due_date]);
  if (d.recipient) kv.push(["Give to", `${d.recipient.name}${d.recipient.tin ? ` (TIN ${d.recipient.tin})` : ""}`]);
  kv.push(["Amount to pay", peso(d.amount_payable)]);
  blocks.push({ kind: "keyValue", rows: kv });
  if (d.fields.length) {
    blocks.push({
      kind: "table",
      columns: [
        { label: "Box on the form", width: 0.6 },
        { label: "Item no.", width: 0.15 },
        { label: "Value", width: 0.25, align: "right" },
      ],
      rows: d.fields.map((f) => [f.label, f.item ?? "to confirm", f.key === "rate" ? `${Number(f.value) * 100}%` : peso(f.value)]),
    });
  }
  if (d.schedule) {
    const n = d.schedule.columns.length;
    blocks.push({ kind: "table", columns: d.schedule.columns.map((c) => ({ label: c.label, width: 1 / n, align: c.align })), rows: d.schedule.rows.map((r) => d.schedule!.columns.map((c) => (c.align === "right" && /^-?\d/.test(r[c.key] ?? "") && !String(r[c.key]).endsWith("%") ? peso(r[c.key]!) : (r[c.key] ?? "")))) });
  }
  blocks.push({ kind: "paragraph", text: "How the amounts were computed:" }, stepsToTable(d.steps));
  for (const w of d.warnings) blocks.push({ kind: "paragraph", text: `Note: ${w}` });
  return blocks;
}

/** One PDF with a cover checklist and every prepared document, for the client to review, sign and file. */
export function packetPdf(client: ClientInfo, packet: Packet, generatedOn: string, reviewed: { by: string; on: string } | null): PdfDoc {
  const blocks: PdfBlock[] = [
    { kind: "keyValue", rows: [["Taxpayer", client.name], ...(client.tin ? [["TIN", client.tin] as [string, string]] : []), ["Period", packet.period_label], ["Total to pay", peso(packet.total_payable)], ["Status", reviewed ? `Reviewed by ${reviewed.by} on ${reviewed.on}` : `Draft — not yet reviewed by ${REVIEWER}`]] },
    { kind: "heading", text: "What to file, by when" },
    {
      kind: "checklist",
      items: packet.documents.map((d) => ({ text: `${d.form} — ${d.title}`, done: false, note: [d.due_date ? `Due ${d.due_date}` : "Attach to the related return", Number(d.amount_payable) > 0 ? `pay ${peso(d.amount_payable)}` : null].filter(Boolean).join(" · ") })),
    },
    { kind: "paragraph", text: "File through eBIRForms or eFPS (or at your RDO) and pay through an authorized agent bank or e-payment channel. TaxGabay prepared these documents from the records you entered; it does not file or pay for you. Keep copies with your books." },
  ];
  if (packet.issues.length) {
    blocks.push({ kind: "heading", text: "Open items in your records" });
    for (const i of packet.issues) blocks.push({ kind: "paragraph", text: `${i.severity === "error" ? "Must fix" : "Check"}: ${i.message}` });
  }
  for (const d of packet.documents) blocks.push(...documentBlocks(d));
  return {
    title: `Filing packet — ${client.name}`,
    subtitle: `${packet.period_label} · Prepared by TaxGabay${reviewed ? ` · Reviewed by ${reviewed.by}` : ""}`,
    generatedOn,
    blocks,
    watermark: reviewed ? undefined : DRAFT,
  };
}
