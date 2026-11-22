import { normalize, scoreFields } from "./search";

export const ISSUANCE_TYPES = ["RR", "RMO", "RMC", "RAMO", "BIR Ruling", "DOF Order", "RA", "EO", "CTA/SC decision", "SEC", "LGU"] as const;
export type IssuanceType = (typeof ISSUANCE_TYPES)[number];

export const ISSUANCE_STATUSES = ["active", "amended", "revoked", "superseded"] as const;
export type IssuanceStatus = (typeof ISSUANCE_STATUSES)[number];

export const WORKFLOW_STATES = ["draft", "reviewed", "published"] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export const RELATIONS = ["amends", "revokes", "implements", "clarifies"] as const;
export type Relation = (typeof RELATIONS)[number];

export const TAX_TYPE_LABELS: Record<string, string> = {
  income_tax: "Income tax",
  vat: "VAT",
  percentage_tax: "Percentage tax",
  withholding_compensation: "Withholding on compensation",
  withholding_expanded: "Expanded withholding",
  estate_tax: "Estate tax",
  donors_tax: "Donor's tax",
  capital_gains_tax: "Capital gains tax",
  documentary_stamp_tax: "Documentary stamp tax",
  penalty: "Penalties",
  registration: "Registration",
  invoicing: "Invoicing",
};

export interface Issuance {
  slug: string;
  type: IssuanceType;
  number: string;
  title: string;
  date_issued: string | null;
  effectivity_date: string | null;
  tax_types: string[];
  topics: string[];
  summary_plain: string | null;
  status: IssuanceStatus;
  source_url: string | null;
  needs_verification: boolean;
}

export interface IssuanceLink {
  from_slug: string;
  to_slug: string;
  relation: Relation;
}

const TYPE_SLUG: Record<IssuanceType, string> = {
  RR: "rr",
  RMO: "rmo",
  RMC: "rmc",
  RAMO: "ramo",
  "BIR Ruling": "bir-ruling",
  "DOF Order": "dof-order",
  RA: "ra",
  EO: "eo",
  "CTA/SC decision": "court",
  SEC: "sec",
  LGU: "lgu",
};

export function issuanceSlug(type: IssuanceType, number: string): string {
  const n = normalize(number).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${TYPE_SLUG[type]}-${n}`;
}

/** "RR 8-2018", "RA 10963", "BIR Ruling OT-123-2024". */
export function issuanceLabel(i: Pick<Issuance, "type" | "number">): string {
  return `${i.type} ${i.number}`;
}

const BIR = "https://www.bir.gov.ph/";

function seed(i: Omit<Issuance, "slug" | "needs_verification" | "status" | "source_url"> & Partial<Pick<Issuance, "status" | "source_url">>): Issuance {
  return { status: "active", source_url: BIR, needs_verification: true, ...i, slug: issuanceSlug(i.type, i.number) };
}

/**
 * Bundled fallback list (used when Supabase is not configured). Only issuances the rule
 * data already cites. Every field is pending CPA verification; unknown dates are null.
 */
export const seedIssuances: Issuance[] = [
  seed({ type: "RA", number: "10963", title: "Tax Reform for Acceleration and Inclusion (TRAIN) Law", date_issued: "2017-12-19", effectivity_date: "2018-01-01", tax_types: ["income_tax", "vat", "percentage_tax", "estate_tax", "donors_tax", "documentary_stamp_tax", "withholding_compensation"], topics: ["tax reform", "graduated rates", "8% option"], summary_plain: "Rewrote individual income tax rates (₱250,000 exempt), introduced the 8% option for small self-employed taxpayers, set estate and donor's tax at a flat 6%, and raised documentary stamp tax rates." }),
  seed({ type: "RA", number: "11534", title: "Corporate Recovery and Tax Incentives for Enterprises (CREATE) Act", date_issued: "2021-03-26", effectivity_date: "2021-04-11", tax_types: ["income_tax", "percentage_tax"], topics: ["corporate income tax", "incentives"], summary_plain: "Cut the corporate income tax to 25% (20% for smaller corporations) from 1 July 2020, temporarily lowered MCIT to 1% and percentage tax to 1% until 30 June 2023, and reformed tax incentives." }),
  seed({ type: "RA", number: "11976", title: "Ease of Paying Taxes Act", date_issued: "2024-01-05", effectivity_date: "2024-01-22", tax_types: ["penalty", "registration", "invoicing", "vat"], topics: ["file anywhere", "taxpayer classification", "invoicing", "reduced penalties"], summary_plain: "Lets taxpayers file and pay anywhere, classifies taxpayers by size, lowers penalties for micro and small taxpayers, makes the invoice the main sales document, and removes the ₱500 annual registration fee." }),
  seed({ type: "RA", number: "12066", title: "CREATE MORE Act", date_issued: null, effectivity_date: null, tax_types: ["income_tax"], topics: ["incentives", "enhanced deductions"], summary_plain: "Amends CREATE's incentive system, including a 20% corporate income tax for registered business enterprises under the enhanced deductions regime." }),
  seed({ type: "RA", number: "9337", title: "Reformed Value-Added Tax Law", date_issued: null, effectivity_date: null, tax_types: ["vat", "income_tax"], topics: ["VAT rate"], summary_plain: "Amended the VAT provisions of the Tax Code, including the 12% VAT rate, and the corporate income tax rate." }),
  seed({ type: "RR", number: "2-98", title: "Withholding tax regulations", date_issued: null, effectivity_date: null, tax_types: ["withholding_compensation", "withholding_expanded"], topics: ["withholding", "ATC"], summary_plain: "The main regulations on withholding of income tax, amended many times since." }),
  seed({ type: "RR", number: "8-2018", title: "Implementing the income tax provisions of the TRAIN Law", date_issued: null, effectivity_date: null, tax_types: ["income_tax"], topics: ["8% option", "graduated rates"], summary_plain: "Rules for the new individual income tax rates and the 8% option, including who can elect it and how." }),
  seed({ type: "RR", number: "11-2018", title: "Amendments to the withholding tax regulations under the TRAIN Law", date_issued: null, effectivity_date: null, tax_types: ["withholding_compensation", "withholding_expanded"], topics: ["withholding tables", "de minimis"], summary_plain: "Revised the withholding tax tables on compensation and expanded withholding rates to match TRAIN." }),
  seed({ type: "RR", number: "13-2018", title: "Implementing the VAT provisions of the TRAIN Law", date_issued: null, effectivity_date: null, tax_types: ["vat"], topics: ["VAT threshold"], summary_plain: "Rules on the VAT changes under TRAIN, including the ₱3,000,000 VAT threshold." }),
  seed({ type: "RR", number: "6-2024", title: "Implementing the penalty provisions of the Ease of Paying Taxes Act", date_issued: null, effectivity_date: null, tax_types: ["penalty"], topics: ["reduced penalties", "micro and small taxpayers"], summary_plain: "Rules for the lower surcharge and interest for micro and small taxpayers." }),
  seed({ type: "RR", number: "7-2024", title: "Implementing the invoicing provisions of the Ease of Paying Taxes Act", date_issued: null, effectivity_date: null, tax_types: ["invoicing", "registration"], topics: ["invoicing", "official receipts"], summary_plain: "Rules making the sales invoice the main document for sales of goods and services, with official receipts as supplementary documents." }),
  seed({ type: "RR", number: "8-2024", title: "Classification of taxpayers under the Ease of Paying Taxes Act", date_issued: null, effectivity_date: null, tax_types: ["registration", "penalty"], topics: ["taxpayer classification"], summary_plain: "Groups taxpayers into micro, small, medium and large by gross sales." }),
  seed({ type: "RMO", number: "7-2015", title: "Revised schedule of compromise penalties", date_issued: null, effectivity_date: null, tax_types: ["penalty"], topics: ["compromise penalty"], summary_plain: "Schedule of suggested compromise penalties for violations of the Tax Code." }),
];

const s = (t: IssuanceType, n: string) => issuanceSlug(t, n);

export const seedIssuanceLinks: IssuanceLink[] = [
  { from_slug: s("RR", "8-2018"), to_slug: s("RA", "10963"), relation: "implements" },
  { from_slug: s("RR", "11-2018"), to_slug: s("RA", "10963"), relation: "implements" },
  { from_slug: s("RR", "11-2018"), to_slug: s("RR", "2-98"), relation: "amends" },
  { from_slug: s("RR", "13-2018"), to_slug: s("RA", "10963"), relation: "implements" },
  { from_slug: s("RR", "6-2024"), to_slug: s("RA", "11976"), relation: "implements" },
  { from_slug: s("RR", "7-2024"), to_slug: s("RA", "11976"), relation: "implements" },
  { from_slug: s("RR", "8-2024"), to_slug: s("RA", "11976"), relation: "implements" },
  { from_slug: s("RA", "12066"), to_slug: s("RA", "11534"), relation: "amends" },
];

// ---------- Filtering and search ----------

export interface IssuanceFilters {
  q?: string;
  type?: IssuanceType | "";
  year?: number | "";
  tax_type?: string;
  topic?: string;
  status?: IssuanceStatus | "";
}

export function issuanceYear(i: Pick<Issuance, "number" | "date_issued">): number | null {
  if (i.date_issued) return Number(i.date_issued.slice(0, 4));
  const m = /(?:^|-)((?:19|20)\d{2})$/.exec(i.number);
  return m ? Number(m[1]) : null;
}

export function filterIssuances(list: readonly Issuance[], f: IssuanceFilters): Issuance[] {
  const scored: { i: Issuance; score: number }[] = [];
  for (const i of list) {
    if (f.type && i.type !== f.type) continue;
    if (f.year && issuanceYear(i) !== f.year) continue;
    if (f.tax_type && !i.tax_types.includes(f.tax_type)) continue;
    if (f.topic && !i.topics.some((t) => normalize(t) === normalize(f.topic!))) continue;
    if (f.status && i.status !== f.status) continue;
    let score = 1;
    if (f.q && f.q.trim()) {
      score = scoreFields(f.q, [
        { text: `${i.type} ${i.number} ${i.number.replace(/-/g, " ")}`, weight: 5 },
        { text: i.title, weight: 3 },
        { text: i.topics.join(" "), weight: 2 },
        { text: `${i.summary_plain ?? ""} ${i.tax_types.map((t) => TAX_TYPE_LABELS[t] ?? t).join(" ")}`, weight: 1 },
      ]);
      if (score === 0) continue;
    }
    scored.push({ i, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || (issuanceYear(b.i) ?? 0) - (issuanceYear(a.i) ?? 0) || a.i.slug.localeCompare(b.i.slug))
    .map((x) => x.i);
}

/** Distinct values for filter dropdowns. */
export function facetValues(list: readonly Issuance[]) {
  const years = [...new Set(list.map(issuanceYear).filter((y): y is number => y !== null))].sort((a, b) => b - a);
  const taxTypes = [...new Set(list.flatMap((i) => i.tax_types))].sort();
  const topics = [...new Set(list.flatMap((i) => i.topics))].sort((a, b) => a.localeCompare(b));
  const types = ISSUANCE_TYPES.filter((t) => list.some((i) => i.type === t));
  return { years, taxTypes, topics, types };
}

// ---------- Relations ----------

const INVERSE: Record<Relation, string> = {
  amends: "Amended by",
  revokes: "Revoked by",
  implements: "Implemented by",
  clarifies: "Clarified by",
};
const FORWARD: Record<Relation, string> = {
  amends: "Amends",
  revokes: "Revokes",
  implements: "Implements",
  clarifies: "Clarifies",
};

export interface RelatedIssuance {
  label: string;
  direction: "out" | "in";
  relation: Relation;
  slug: string;
  issuance: Issuance | null;
}

export function relatedIssuances(slug: string, links: readonly IssuanceLink[], all: readonly Issuance[]): RelatedIssuance[] {
  const bySlug = new Map(all.map((i) => [i.slug, i]));
  const out: RelatedIssuance[] = [];
  for (const l of links) {
    if (l.from_slug === slug) out.push({ label: FORWARD[l.relation], direction: "out", relation: l.relation, slug: l.to_slug, issuance: bySlug.get(l.to_slug) ?? null });
    if (l.to_slug === slug) out.push({ label: INVERSE[l.relation], direction: "in", relation: l.relation, slug: l.from_slug, issuance: bySlug.get(l.from_slug) ?? null });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label) || a.slug.localeCompare(b.slug));
}

// ---------- Workflow ----------

const ALLOWED: Record<WorkflowState, WorkflowState[]> = {
  draft: ["reviewed"],
  reviewed: ["published", "draft"],
  published: ["draft"],
};

/** Mirrors the database trigger, so the admin UI can show only valid actions. */
export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return ALLOWED[from].includes(to);
}

/** Problems that block saving or reviewing an issuance. */
export function validateIssuance(i: Partial<Issuance>): string[] {
  const p: string[] = [];
  if (!i.type || !ISSUANCE_TYPES.includes(i.type)) p.push("Choose an issuance type.");
  if (!i.number?.trim()) p.push("Enter the issuance number.");
  if (!i.title?.trim()) p.push("Enter the title.");
  for (const k of ["date_issued", "effectivity_date"] as const) {
    const v = i[k];
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) p.push(`${k === "date_issued" ? "Date issued" : "Effectivity date"} must be a date.`);
  }
  if (i.source_url && !/^https:\/\//.test(i.source_url)) p.push("The source link must start with https://.");
  return p;
}

/** Extra checks before an issuance can be marked reviewed. */
export function reviewBlockers(i: Partial<Issuance>): string[] {
  const p = validateIssuance(i);
  if (!i.summary_plain?.trim()) p.push("Write the plain-language summary.");
  if (!i.source_url) p.push("Add the link to the official source.");
  if (!i.tax_types?.length) p.push("Tag at least one tax type.");
  return p;
}
