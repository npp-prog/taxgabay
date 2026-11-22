import type { DeadlineRule, Frequency } from "./data/deadline-rules";
import { getForm } from "./data/forms";
import {
  applies,
  businessForm,
  hasBusiness,
  isIndividual,
  normalizeProfile,
  type Applicability,
  type Profile,
} from "./profile";
import { inForce } from "./rules";
import type { ISODate } from "./types";

export interface SummaryItem {
  code: string;
  title: string;
  frequency: Frequency;
  applicability: Exclude<Applicability, "no">;
  guide_slug: string | null;
}

export interface ProfileSummary {
  registrations: { title: string; detail: string }[];
  returns: SummaryItem[];
  tax_types: string[];
  notes: string[];
}

/** "Here is what applies to you": registrations, returns, frequencies and tax types. */
export function summarizeProfile(profileIn: Profile, rules: readonly DeadlineRule[], on: ISODate): ProfileSummary {
  const p = normalizeProfile(profileIn);
  const registrations: ProfileSummary["registrations"] = [];
  const notes: string[] = [];
  const taxTypes = new Set<string>();

  const form = businessForm(p.taxpayer_type);
  if (form === "dti") registrations.push({ title: "DTI business name registration", detail: "Register your business name with the DTI (BNRS)." });
  if (form === "sec") registrations.push({ title: "SEC registration", detail: "Register the partnership, corporation or OPC with the SEC." });
  if (form === "cda") registrations.push({ title: "CDA registration", detail: "Register the cooperative with the Cooperative Development Authority." });
  if (hasBusiness(p.taxpayer_type)) {
    registrations.push(
      { title: "Barangay clearance and mayor's/business permit", detail: "From the barangay and city/municipal hall where the business is located." },
      {
        title: "BIR registration",
        detail: isIndividual(p.taxpayer_type)
          ? "BIR Form 1901 (via ORUS or your RDO); get your Certificate of Registration (Form 2303), register books of accounts and set up invoicing."
          : "BIR Form 1903 (via ORUS or your RDO); get your Certificate of Registration (Form 2303), register books of accounts and set up invoicing.",
      },
    );
  }
  if (p.has_employees) {
    registrations.push({ title: "Employer registration with SSS, PhilHealth and Pag-IBIG", detail: "Required once you hire employees." });
  }

  const returns: SummaryItem[] = [];
  for (const r of rules) {
    if (!inForce(r, on)) continue;
    const a = applies(r.applies_when, p);
    if (a === "no") continue;
    returns.push({
      code: r.form_code,
      title: r.title,
      frequency: r.frequency,
      applicability: a,
      guide_slug: getForm(r.form_code)?.guide_slug ?? null,
    });
    if (r.form_code.startsWith("17")) taxTypes.add("Income tax");
    if (r.form_code === "2551Q") taxTypes.add("Percentage tax");
    if (r.form_code === "2550Q") taxTypes.add("Value-added tax (VAT)");
    if (r.form_code === "1601C" || r.form_code === "1604C") taxTypes.add("Withholding tax on compensation");
    if (["0619E", "1601EQ", "1604E"].includes(r.form_code)) taxTypes.add("Expanded withholding tax");
  }

  if (p.taxpayer_type === "employee") {
    notes.push(
      "If you have one employer for the whole year and your employer withheld the correct tax, you usually qualify for substituted filing: your BIR Form 2316 serves as your return. Ask your employer for your 2316 each year.",
    );
    taxTypes.add("Income tax (withheld by your employer)");
  }
  if (p.taxpayer_type === "estate") {
    notes.push("Estate tax (Form 1801) is due within one year from the date of death. Use the estate tax calculator and the \"Settling an estate\" guide.");
    taxTypes.add("Estate tax");
  }
  if (p.taxpayer_type === "one_time") {
    notes.push("One-time transactions (sale of real property, donation, sale of shares) involve capital gains tax, donor's tax and documentary stamp tax — see the calculators and life-event guides.");
  }
  if (p.vat_status === "not_sure" && hasBusiness(p.taxpayer_type)) {
    notes.push("Your returns depend on whether you are VAT-registered. Check your Certificate of Registration (Form 2303) under \"Tax types\".");
  }
  if (p.income_tax_option === "not_sure") {
    notes.push("Use the income tax calculator to compare the 8% option and graduated rates before you file your first quarterly return of the year.");
  }

  return { registrations, returns, tax_types: [...taxTypes], notes };
}
