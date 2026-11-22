import "server-only";
import { createClient } from "@supabase/supabase-js";
import { faqs } from "@taxgabay/content/faq";
import { GLOSSARY_NEEDS_VERIFICATION, glossary, glossarySlug } from "@taxgabay/content/glossary";
import { issuanceLabel, seedIssuances, type Issuance } from "@taxgabay/content/issuances";
import { deadlineRules, lifeEvents, peso, taxRules, type TaxRule } from "@taxgabay/tax-engine";
import type { SourceDoc } from "./assistant-core";
import { getGuide, listGuides } from "./guides";
import { getHubArticle, listHubArticles } from "./hub";

const RULE_LABELS: Record<string, string> = {
  "income_tax.individual.graduated": "Graduated income tax rates for individuals",
  "income_tax.individual.eight_percent": "8% income tax option for individuals",
  "income_tax.individual.osd": "Optional standard deduction (OSD) for individuals",
  "percentage_tax.sec116": "Percentage tax rate (Sec. 116)",
  "vat.rate": "VAT rate",
  "vat.threshold": "VAT registration threshold",
  "registration.annual_fee": "BIR annual registration fee",
  "taxpayer_size.classes": "Taxpayer size classes (micro, small, medium, large)",
  "penalty.surcharge": "Surcharge on late filing or payment",
  "penalty.interest": "Interest on late payment",
  "penalty.compromise.failure_to_file_pay": "Compromise penalty schedule",
  "corporate.rcit": "Regular corporate income tax (RCIT)",
  "corporate.mcit": "Minimum corporate income tax (MCIT)",
  "corporate.mcit_start": "When MCIT starts to apply",
  "estate.tax": "Estate tax",
  "donors.tax": "Donor's tax",
  "cgt.real_property": "Capital gains tax on real property",
  "cgt.unlisted_shares": "Capital gains tax on unlisted shares",
  "dst.sale_real_property": "Documentary stamp tax on sale of real property",
  "dst.original_issue_shares": "Documentary stamp tax on original issue of shares",
  "dst.debt_instruments": "Documentary stamp tax on loans and debt instruments",
  "withholding.compensation.benefits_exclusion": "13th month pay and other benefits exclusion",
  "withholding.compensation.de_minimis": "De minimis benefits ceilings",
};

const num = (v: string) => (/^0\.\d+$/.test(v) || v === "0" ? `${Number((Number(v) * 100).toFixed(4))}%` : peso(v));

/** Plain-language description of a rule value, for the assistant's documents. */
export function describeRuleValue(value: unknown): string {
  if (!value || typeof value !== "object") return String(value);
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.brackets)) {
    return (v.brackets as { over: string; not_over: string | null; base?: string; rate?: string; amount?: string }[])
      .map((b) =>
        b.amount !== undefined
          ? `tax due over ${peso(b.over)}${b.not_over ? ` up to ${peso(b.not_over)}` : ""}: ${peso(b.amount)}`
          : `over ${peso(b.over)}${b.not_over ? ` up to ${peso(b.not_over)}` : ""}: ${peso(b.base ?? "0")} plus ${num(b.rate ?? "0")} of the excess over ${peso(b.over)}`,
      )
      .join("; ");
  }
  if (Array.isArray(v.classes)) {
    return (v.classes as { size: string; from: string; below: string | null }[]).map((c) => `${c.size}: gross sales from ${peso(c.from)}${c.below ? ` to below ${peso(c.below)}` : " and up"}`).join("; ");
  }
  if (Array.isArray(v.items)) {
    return (v.items as { label: string; ceiling: string; per: string }[]).map((i) => `${i.label}: up to ${peso(i.ceiling)} per ${i.per}`).join("; ");
  }
  return Object.entries(v)
    .filter(([, x]) => x !== null && typeof x !== "object")
    .map(([k, x]) => `${k.replace(/_/g, " ")}: ${typeof x === "string" && /^\d/.test(x) ? num(x) : String(x)}`)
    .join("; ");
}

function ruleDoc(r: TaxRule): SourceDoc {
  const label = RULE_LABELS[r.rule_key] ?? (r.rule_key.startsWith("ewt.atc.") ? `Expanded withholding tax rate for ATC ${r.rule_key.slice(8)}` : r.rule_key);
  const period = r.effective_to ? `from ${r.effective_from} to ${r.effective_to}` : `from ${r.effective_from} onwards`;
  return {
    id: `rule:${r.id}`,
    kind: "rule",
    title: `${label} (${period})`,
    href: "/calculators",
    text: `${label}, in force ${period}${r.taxpayer_category !== "all" ? `, for ${r.taxpayer_category.replace(/_/g, " ")} taxpayers` : ""}. ${describeRuleValue(r.value)}. Legal basis: ${r.legal_basis}.${r.note ? ` Note: ${r.note}` : ""}`,
    verified: !r.needs_verification && Boolean(r.last_verified_at),
  };
}

export function issuanceDocs(list: readonly Issuance[], verifiedOverride?: boolean): SourceDoc[] {
  return list.map((i) => ({
    id: `issuance:${i.slug}`,
    kind: "issuance",
    title: `${issuanceLabel(i)} — ${i.title}`,
    href: `/issuances/${i.slug}`,
    text: `${issuanceLabel(i)}: ${i.title}. ${i.date_issued ? `Issued ${i.date_issued}. ` : ""}${i.effectivity_date ? `Effective ${i.effectivity_date}. ` : ""}${i.summary_plain ?? ""} Status: ${i.status}.`,
    verified: verifiedOverride ?? !i.needs_verification,
  }));
}

let staticDocs: SourceDoc[] | null = null;

/** Content bundled with the app (built once per server instance). */
export function staticSourceDocs(): SourceDoc[] {
  if (staticDocs) return staticDocs;
  const docs: SourceDoc[] = taxRules.map(ruleDoc);
  for (const d of deadlineRules) {
    docs.push({ id: `deadline:${d.id}`, kind: "deadline", title: `Deadline for BIR Form ${d.form_code}: ${d.title}`, href: "/calendar", text: `BIR Form ${d.form_code} (${d.title}). ${d.legal_basis}.${d.note ? ` Note: ${d.note}` : ""}`, verified: !d.needs_verification && Boolean(d.last_verified_at) });
  }
  for (const fm of listGuides()) {
    docs.push({ id: `guide:${fm.slug}`, kind: "guide", title: fm.title, href: `/guides/${fm.slug}`, text: getGuide(fm.slug)!.body, verified: !fm.needs_verification && Boolean(fm.last_verified_at) });
  }
  for (const fm of listHubArticles()) {
    docs.push({ id: `article:${fm.slug}`, kind: "article", title: fm.title, href: `/learn/${fm.slug}`, text: getHubArticle(fm.slug)!.body, verified: !fm.needs_verification && Boolean(fm.last_verified_at) });
  }
  for (const t of glossary) {
    docs.push({ id: `glossary:${t.term}`, kind: "glossary", title: `Glossary: ${t.term}`, href: `/learn/glossary#${glossarySlug(t.term)}`, text: `${t.term}${t.aka?.length ? ` (also called ${t.aka.join(", ")})` : ""}: ${t.definition}`, verified: !GLOSSARY_NEEDS_VERIFICATION });
  }
  for (const q of faqs) {
    docs.push({ id: `faq:${q.id}`, kind: "faq", title: `FAQ: ${q.question}`, href: `/learn/faq#${q.id}`, text: `${q.question} ${q.answer}`, verified: !GLOSSARY_NEEDS_VERIFICATION });
  }
  for (const e of lifeEvents) {
    docs.push({
      id: `life:${e.slug}`,
      kind: "life_event",
      title: e.title,
      href: `/life-events/${e.slug}`,
      text: `${e.summary}\n\n${e.steps.map((s) => `## ${s.title}\n\n${s.detail}${s.deadline ? ` Deadline: ${s.deadline}.` : ""}${s.form_code ? ` Form: ${s.form_code}.` : ""}${s.legal_basis ? ` Basis: ${s.legal_basis}.` : ""}`).join("\n\n")}`,
      verified: !e.needs_verification,
    });
  }
  staticDocs = docs;
  return docs;
}

/** Published issuances from Supabase when configured (they passed review), else the bundled list. */
export async function issuanceSourceDocs(): Promise<SourceDoc[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return issuanceDocs(seedIssuances);
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } })
    .from("issuances")
    .select("slug,type,number,title,date_issued,effectivity_date,tax_types,topics,summary_plain,status,source_url,needs_verification")
    .eq("workflow_state", "published");
  if (error) return [];
  return issuanceDocs((data ?? []) as Issuance[], true);
}
