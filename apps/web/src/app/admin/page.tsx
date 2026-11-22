import { faqs } from "@taxgabay/content/faq";
import { GLOSSARY_NEEDS_VERIFICATION, glossary } from "@taxgabay/content/glossary";
import { checklistItems, deadlineRules, forms, holidays, lifeEvents, registrationSteps, taxRules } from "@taxgabay/tax-engine";
import { listGuides } from "@/lib/guides";
import { listHubArticles } from "@/lib/hub";
import { AdminDashboard, type VerificationRow } from "./dashboard";

export default function AdminPage() {
  const guides = listGuides();
  const articles = listHubArticles();
  const rows: VerificationRow[] = [
    { area: "Tax rules", total: taxRules.length, pending: taxRules.filter((r) => r.needs_verification).length, where: "packages/tax-engine/src/data/tax-rules*.ts" },
    { area: "Deadline rules", total: deadlineRules.length, pending: deadlineRules.filter((r) => r.needs_verification).length, where: "packages/tax-engine/src/data/deadline-rules.ts" },
    { area: "Holidays (bundled)", total: holidays.length, pending: holidays.filter((h) => h.needs_verification).length, where: "packages/tax-engine/src/data/holidays.ts" },
    { area: "Forms", total: forms.length, pending: forms.filter((f) => f.needs_verification).length, where: "packages/tax-engine/src/data/forms.ts" },
    { area: "Registration steps", total: registrationSteps.length, pending: registrationSteps.filter((s) => s.needs_verification).length, where: "packages/tax-engine/src/data/registration-steps.ts" },
    { area: "Checklist items", total: checklistItems.length, pending: checklistItems.filter((c) => c.needs_verification).length, where: "packages/tax-engine/src/data/checklist-items.ts" },
    { area: "Life events", total: lifeEvents.length, pending: lifeEvents.filter((e) => e.needs_verification).length, where: "packages/tax-engine/src/data/life-events.ts" },
    { area: "Filing guides", total: guides.length, pending: guides.filter((g) => g.needs_verification).length, where: "packages/content/guides/*.mdx" },
    { area: "Hub articles", total: articles.length, pending: articles.filter((a) => a.needs_verification).length, where: "packages/content/hub/*.mdx" },
    { area: "Glossary and FAQs", total: glossary.length + faqs.length, pending: GLOSSARY_NEEDS_VERIFICATION ? glossary.length + faqs.length : 0, where: "packages/content/src/glossary.ts, faq.ts" },
  ];
  const pendingRules = taxRules
    .filter((r) => r.needs_verification)
    .map((r) => ({ id: r.id, key: r.rule_key, effective: `${r.effective_from} → ${r.effective_to ?? "open"}`, legal_basis: r.legal_basis, low: Boolean(r.note?.includes("LOW CONFIDENCE")) }));
  return <AdminDashboard rows={rows} pendingRules={pendingRules} />;
}
