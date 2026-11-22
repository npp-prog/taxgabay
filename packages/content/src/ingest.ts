import { issuanceSlug, type IssuanceType, type Relation } from "./issuances";

/**
 * Drafts an issuance record from the text of a BIR issuance. Pure: no network.
 * Output is only a starting point for the admin; nothing is published automatically.
 */

export interface DraftReference {
  type: IssuanceType;
  number: string;
  slug: string;
  relation_guess: Relation | null;
}

export interface IssuanceDraft {
  type: IssuanceType | null;
  number: string | null;
  title: string | null;
  date_issued: string | null;
  tax_types: string[];
  topics: string[];
  references: DraftReference[];
  source_url: string | null;
  notes: string[];
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Header patterns, most specific first. */
const HEADERS: { type: IssuanceType; re: RegExp }[] = [
  { type: "RAMO", re: /REVENUE\s+ADMINISTRATIVE\s+MEMORANDUM\s+ORDER\s+NO\.?\s*([0-9]{1,3}\s*-\s*[0-9]{4})/i },
  { type: "RR", re: /REVENUE\s+REGULATIONS?\s+NO\.?\s*([0-9]{1,3}\s*-\s*[0-9]{4})/i },
  { type: "RMO", re: /REVENUE\s+MEMORANDUM\s+ORDER\s+NO\.?\s*([0-9]{1,3}\s*-\s*[0-9]{4})/i },
  { type: "RMC", re: /REVENUE\s+MEMORANDUM\s+CIRCULAR\s+NO\.?\s*([0-9]{1,3}\s*-\s*[0-9]{4})/i },
  { type: "BIR Ruling", re: /BIR\s+RULING\s+(?:NO\.?\s*)?([A-Z]{0,4}-?[0-9]{1,4}-[0-9]{4})/i },
  { type: "RA", re: /REPUBLIC\s+ACT\s+NO\.?\s*([0-9]{3,5})/i },
  { type: "EO", re: /EXECUTIVE\s+ORDER\s+NO\.?\s*([0-9]{1,4}(?:\s*,?\s*S(?:ERIES)?\.?\s*(?:OF\s*)?[0-9]{4})?)/i },
  { type: "DOF Order", re: /DEPARTMENT\s+ORDER\s+NO\.?\s*([0-9]{1,3}\s*-\s*[0-9]{4})/i },
];

/** In-text references, e.g. "RR No. 11-2018", "Revenue Regulations No. 2-98", "RA 11976". */
const REF_PATTERNS: { type: IssuanceType; re: RegExp }[] = [
  { type: "RAMO", re: /\b(?:RAMO|Revenue\s+Administrative\s+Memorandum\s+Order)\s*(?:No\.?\s*)?([0-9]{1,3}-[0-9]{2,4})\b/gi },
  { type: "RR", re: /\b(?:RR|Revenue\s+Regulations?)\s*(?:No\.?\s*|Nos\.?\s*)?([0-9]{1,3}-[0-9]{2,4})\b/gi },
  { type: "RMO", re: /\b(?:RMO|Revenue\s+Memorandum\s+Order)\s*(?:No\.?\s*)?([0-9]{1,3}-[0-9]{2,4})\b/gi },
  { type: "RMC", re: /\b(?:RMC|Revenue\s+Memorandum\s+Circular)\s*(?:No\.?\s*)?([0-9]{1,3}-[0-9]{2,4})\b/gi },
  { type: "RA", re: /\b(?:RA|R\.\s?A\.|Republic\s+Act)\s*(?:No\.?\s*)?([0-9]{3,5})\b/gi },
];

const TAX_KEYWORDS: [string, RegExp][] = [
  ["income_tax", /\bincome\s+tax/i],
  ["vat", /\bvalue[- ]added\s+tax|\bVAT\b/],
  ["percentage_tax", /\bpercentage\s+tax/i],
  ["withholding_compensation", /withholding\s+(?:tax\s+)?on\s+compensation|withheld\s+on\s+compensation/i],
  ["withholding_expanded", /expanded\s+withholding|creditable\s+withholding/i],
  ["estate_tax", /\bestate\s+tax/i],
  ["donors_tax", /\bdonor'?s\s+tax/i],
  ["capital_gains_tax", /\bcapital\s+gains\s+tax/i],
  ["documentary_stamp_tax", /\bdocumentary\s+stamp\s+tax/i],
  ["penalty", /\bsurcharge|\bcompromise\s+penalt|\bdelinquency\s+interest/i],
  ["invoicing", /\binvoic(?:e|ing)|\bofficial\s+receipt/i],
  ["registration", /\bregistration\b|\bcertificate\s+of\s+registration/i],
];

const TOPIC_KEYWORDS: [string, RegExp][] = [
  ["deadline extension", /\bextension\b.*\b(?:deadline|filing)|\bextend(?:ed|ing)?\s+the\s+(?:deadline|filing)/i],
  ["e-filing", /\beFPS\b|\beBIRForms\b|electronic\s+filing/i],
  ["8% option", /\b8%\s+(?:income\s+tax\s+)?(?:rate|option)/i],
  ["taxpayer classification", /\bmicro\b.*\bsmall\b.*\bmedium\b/i],
  ["tax incentives", /\bincentive/i],
  ["books of accounts", /\bbooks\s+of\s+accounts?/i],
];

function canonNumber(n: string): string {
  return n.replace(/\s+/g, "").toUpperCase();
}

function parseDate(text: string): string | null {
  const re = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+((?:19|20)\d{2})\b/i;
  const m = re.exec(text);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1]!.toLowerCase()) + 1;
  const day = Number(m[2]);
  if (day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function guessRelation(before: string): Relation | null {
  const w = before.toLowerCase();
  if (/(revok|repeal|supersed)\w*\W*$/.test(w) || /(revok|repeal|supersed)/.test(w.slice(-60))) return "revokes";
  if (/amend/.test(w.slice(-60))) return "amends";
  if (/implement/.test(w.slice(-80))) return "implements";
  if (/clarif/.test(w.slice(-60))) return "clarifies";
  return null;
}

/** "… is hereby revoked/amended" right after the reference. */
function relationAfter(after: string): Relation | null {
  const m = /^[^.;\n]{0,30}?\b(?:is|are)\s+hereby\s+(revoked|repealed|superseded|amended|modified|clarified)/i.exec(after);
  if (!m) return null;
  const v = m[1]!.toLowerCase();
  if (v === "amended" || v === "modified") return "amends";
  if (v === "clarified") return "clarifies";
  return "revokes";
}

function extractTitle(text: string, headerEnd: number): string | null {
  const subject = /SUBJECT\s*:\s*([\s\S]+?)(?:\n\s*\n|\bTO\s*:|$)/i.exec(text);
  if (subject) return subject[1]!.replace(/\s+/g, " ").trim().slice(0, 300) || null;
  // Otherwise, the first substantial line after the header.
  const after = text.slice(headerEnd).split(/\n/).map((l) => l.trim()).filter(Boolean);
  const line = after.find((l) => l.length > 15 && !parseDate(l) && !/^(issued|date|series)/i.test(l));
  return line ? line.replace(/\s+/g, " ").slice(0, 300) : null;
}

export function draftIssuanceFromText(raw: string, sourceUrl: string | null = null): IssuanceDraft {
  const text = raw.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const head = text.slice(0, 2500);
  const notes: string[] = [];

  let type: IssuanceType | null = null;
  let number: string | null = null;
  let headerEnd = 0;
  for (const h of HEADERS) {
    const m = h.re.exec(head);
    if (m) {
      type = h.type;
      number = canonNumber(m[1]!);
      headerEnd = m.index + m[0].length;
      break;
    }
  }
  if (!type) notes.push("Could not find the issuance type and number in the first page — enter them manually.");

  const date_issued = parseDate(head);
  if (!date_issued) notes.push("Could not find the date issued.");

  const title = type ? extractTitle(text, headerEnd) : null;
  if (!title) notes.push("Could not find a title or SUBJECT line.");

  const tax_types = TAX_KEYWORDS.filter(([, re]) => re.test(text)).map(([k]) => k);
  const topics = TOPIC_KEYWORDS.filter(([, re]) => re.test(text)).map(([k]) => k);

  const selfSlug = type && number ? issuanceSlug(type, number) : null;
  const refs = new Map<string, DraftReference>();
  for (const p of REF_PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text))) {
      const num = canonNumber(m[1]!);
      const slug = issuanceSlug(p.type, num);
      if (slug === selfSlug) continue;
      const relation =
        relationAfter(text.slice(m.index + m[0].length, m.index + m[0].length + 60)) ??
        guessRelation(text.slice(Math.max(0, m.index - 120), m.index));
      const prev = refs.get(slug);
      if (!prev) refs.set(slug, { type: p.type, number: num, slug, relation_guess: relation });
      else if (!prev.relation_guess && relation) prev.relation_guess = relation;
    }
  }
  if (refs.size) notes.push("Check the suggested related issuances and their relation before saving.");
  notes.push("Write the plain-language summary yourself; it is never generated.");

  return { type, number, title, date_issued, tax_types, topics, references: [...refs.values()], source_url: sourceUrl, notes };
}

/** Allow-list for the admin source fetcher (https, government domains). */
export function isAllowedSourceUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  const host = u.hostname.toLowerCase();
  return host === "bir.gov.ph" || host.endsWith(".bir.gov.ph") || host === "dof.gov.ph" || host.endsWith(".dof.gov.ph") || host === "officialgazette.gov.ph" || host.endsWith(".officialgazette.gov.ph");
}
