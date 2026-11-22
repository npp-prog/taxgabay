import "server-only";
import { faqs } from "@taxgabay/content/faq";
import { glossary, glossarySlug } from "@taxgabay/content/glossary";
import { issuanceLabel, seedIssuances, type Issuance } from "@taxgabay/content/issuances";
import { stripMarkdown, type SearchDoc } from "@taxgabay/content/search";
import { lifeEvents } from "@taxgabay/tax-engine";
import { getGuide, listGuides } from "./guides";
import { getHubArticle, listHubArticles } from "./hub";

const CALCULATORS: { slug: string; title: string; keywords: string[] }[] = [
  { slug: "income-tax", title: "Income tax: 8% vs graduated", keywords: ["OSD", "itemized", "self-employed", "freelancer", "mixed income", "1701Q", "1701"] },
  { slug: "percentage-tax", title: "Percentage tax", keywords: ["2551Q", "non-VAT", "3%"] },
  { slug: "vat", title: "VAT", keywords: ["2550Q", "input", "output", "12%"] },
  { slug: "penalty", title: "Late filing and payment penalties", keywords: ["surcharge", "interest", "compromise", "late"] },
  { slug: "corporate", title: "Corporate income tax (RCIT vs MCIT)", keywords: ["corporation", "1702", "MCIT", "RCIT", "CREATE"] },
  { slug: "withholding-compensation", title: "Withholding tax on compensation", keywords: ["payroll", "employee", "1601C", "13th month", "de minimis"] },
  { slug: "ewt", title: "Expanded withholding tax", keywords: ["ATC", "2307", "0619E", "rent", "professional fees"] },
  { slug: "estate", title: "Estate tax", keywords: ["1801", "heirs", "family home", "death"] },
  { slug: "donors", title: "Donor's tax", keywords: ["1800", "gift", "donation"] },
  { slug: "cgt", title: "Capital gains tax", keywords: ["1706", "1707", "real property", "shares", "zonal"] },
  { slug: "dst", title: "Documentary stamp tax", keywords: ["2000", "2000-OT", "deed of sale", "loan", "shares"] },
];

export function issuanceDoc(i: Issuance): SearchDoc {
  return {
    id: `issuance:${i.slug}`,
    kind: "issuance",
    title: `${issuanceLabel(i)} — ${i.title}`,
    href: `/issuances/${i.slug}`,
    text: i.summary_plain ?? "",
    keywords: [i.type, i.number, ...i.topics, ...i.tax_types],
  };
}

/** Index of all static content, built at build time. */
export function buildSearchIndex(): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const fm of listGuides()) {
    const g = getGuide(fm.slug)!;
    docs.push({ id: `guide:${fm.slug}`, kind: "guide", title: fm.title, href: `/guides/${fm.slug}`, text: stripMarkdown(g.body), keywords: [fm.form, ...fm.tax_types] });
  }
  for (const fm of listHubArticles()) {
    const a = getHubArticle(fm.slug)!;
    docs.push({ id: `article:${fm.slug}`, kind: "article", title: fm.title, href: `/learn/${fm.slug}`, text: `${fm.summary} ${stripMarkdown(a.body)}`, keywords: fm.tax_types });
  }
  for (const t of glossary) {
    docs.push({ id: `glossary:${t.term}`, kind: "glossary", title: t.term, href: `/learn/glossary#${glossarySlug(t.term)}`, text: t.definition, keywords: t.aka ?? [] });
  }
  for (const q of faqs) {
    docs.push({ id: `faq:${q.id}`, kind: "faq", title: q.question, href: `/learn/faq#${q.id}`, text: q.answer, keywords: [q.category] });
  }
  for (const e of lifeEvents) {
    docs.push({ id: `life:${e.slug}`, kind: "life_event", title: e.title, href: `/life-events/${e.slug}`, text: `${e.summary} ${e.steps.map((s) => `${s.title}. ${s.detail}`).join(" ")}`, keywords: e.steps.flatMap((s) => (s.form_code ? [s.form_code] : [])) });
  }
  for (const c of CALCULATORS) {
    docs.push({ id: `calc:${c.slug}`, kind: "calculator", title: `${c.title} calculator`, href: `/calculators/${c.slug}`, text: c.keywords.join(" "), keywords: c.keywords });
  }
  for (const i of seedIssuances) docs.push(issuanceDoc(i));
  return docs;
}
