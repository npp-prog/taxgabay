export interface LifeEventLink {
  label: string;
  href: string;
}

export interface LifeEventStep {
  title: string;
  detail: string;
  /** Deadline in plain words, if any (flagged for verification). */
  deadline?: string;
  form_code?: string;
  legal_basis?: string;
  links: LifeEventLink[];
}

export interface LifeEvent {
  slug: string;
  title: string;
  summary: string;
  steps: LifeEventStep[];
  needs_verification: boolean;
}

const calc = (slug: string, label: string): LifeEventLink => ({ label, href: `/calculators/${slug}` });
const guide = (slug: string, label: string): LifeEventLink => ({ label, href: `/guides/${slug}` });

export const lifeEvents: LifeEvent[] = [
  {
    slug: "start-a-business",
    title: "Starting a business",
    summary: "From choosing your business form to filing your first returns.",
    needs_verification: true,
    steps: [
      { title: "Choose your business form", detail: "Sole proprietorship (DTI), partnership, corporation or OPC (SEC), or cooperative (CDA). This decides your registrations and tax options.", links: [{ label: "Update your profile", href: "/profile" }] },
      { title: "Register your business", detail: "Follow the roadmap for your business form, up to your BIR Certificate of Registration.", links: [{ label: "Registration roadmap", href: "/roadmap" }] },
      { title: "Choose your income tax option (individuals)", detail: "Compare the 8% option with graduated rates. Elect 8% at registration or in your first quarterly return.", deadline: "First quarterly return of the year", legal_basis: "RR 8-2018", links: [calc("income-tax", "Income tax: 8% vs graduated")] },
      { title: "Set up your one-time and recurring compliance", detail: "Books, invoices, posting your COR, and the returns you file each month, quarter and year.", links: [{ label: "Checklists", href: "/checklists" }, { label: "Tax calendar", href: "/calendar" }] },
    ],
  },
  {
    slug: "hire-first-employee",
    title: "Hiring your first employee",
    summary: "Employer registrations, withholding on compensation and the returns that come with it.",
    needs_verification: true,
    steps: [
      { title: "Register as an employer", detail: "SSS, PhilHealth and Pag-IBIG, and update your BIR registration to add withholding tax on compensation (Form 1905).", form_code: "1905", legal_basis: "RA 11199; RA 11223; RA 9679; RR 7-2012 (to confirm)", links: [{ label: "Employer step in the roadmap", href: "/roadmap" }] },
      { title: "Withhold tax every payroll", detail: "Use the revised withholding tax table for the payroll period.", legal_basis: "RR 11-2018", links: [calc("withholding-compensation", "Withholding on compensation")] },
      { title: "Remit monthly", detail: "File 1601C and remit the tax withheld.", deadline: "10th of the following month (15 January for December)", form_code: "1601C", links: [guide("1601c", "1601C guide")] },
      { title: "Year-end", detail: "Annualize each employee's tax, give them Form 2316, and file 1604C with the alphalist.", deadline: "31 January", form_code: "1604C", links: [guide("1604c", "1604C guide")] },
      { title: "Turn on employer items in your profile", detail: "So your calendar and checklists include employer obligations.", links: [{ label: "Update your profile", href: "/profile" }] },
    ],
  },
  {
    slug: "close-a-business",
    title: "Closing a business",
    summary: "Cancelling your BIR registration and settling final obligations.",
    needs_verification: true,
    steps: [
      { title: "Apply for cancellation of registration", detail: "File BIR Form 1905 with your RDO, with the supporting documents (list of ending inventory, unused invoices for cancellation, books of accounts).", form_code: "1905", legal_basis: "NIRC Sec. 236(F), as amended by RA 11976; RR 7-2024 (to confirm)", links: [] },
      { title: "File your final returns and pay any tax due", detail: "Including the final income tax return and any open percentage tax, VAT and withholding returns. The BIR may audit before issuing the tax clearance.", deadline: "Per RDO instructions (to confirm)", links: [calc("penalty", "Penalty calculator")] },
      { title: "Surrender unused invoices and your COR", detail: "Unused invoices are cancelled; the Certificate of Registration is returned.", links: [] },
      { title: "Close your LGU, DTI/SEC and employer registrations", detail: "Retire your business permit, cancel the business name or dissolve the entity, and deregister as an employer.", links: [] },
    ],
  },
  {
    slug: "settle-an-estate",
    title: "Settling an estate",
    summary: "Estate tax, the eCAR, and transferring the decedent's property.",
    needs_verification: true,
    steps: [
      { title: "List the estate and get values", detail: "Inventory all property at fair market value at the time of death (zonal and assessor's values for real property) and the deductions (claims, unpaid mortgages, family home).", links: [calc("estate", "Estate tax calculator")] },
      { title: "File the estate tax return and pay", detail: "File BIR Form 1801 with the RDO. Payment by instalment or extension may be allowed in some cases.", deadline: "Within one year from the date of death", form_code: "1801", legal_basis: "NIRC Secs. 90 and 91, as amended by RA 10963", links: [] },
      { title: "Get the electronic Certificate Authorizing Registration (eCAR)", detail: "The BIR issues an eCAR so the property can be transferred to the heirs.", links: [] },
      { title: "Transfer the titles", detail: "Pay the local transfer tax and register the transfer with the Registry of Deeds and the assessor.", links: [] },
    ],
  },
  {
    slug: "sell-real-property",
    title: "Selling real property",
    summary: "Capital gains tax, documentary stamp tax and the transfer of title.",
    needs_verification: true,
    steps: [
      { title: "Compute capital gains tax", detail: "6% of the highest of the selling price, zonal value and assessor's value (for property held as a capital asset).", links: [calc("cgt", "Capital gains tax calculator")] },
      { title: "File and pay capital gains tax", detail: "BIR Form 1706.", deadline: "Within 30 days after the sale", form_code: "1706", legal_basis: "NIRC Sec. 24(D); RR 13-99 (to confirm)", links: [] },
      { title: "File and pay documentary stamp tax", detail: "BIR Form 2000-OT on the deed of sale.", deadline: "Within 5 days after the end of the month of the sale", form_code: "2000-OT", legal_basis: "NIRC Secs. 196 and 200", links: [calc("dst", "Documentary stamp tax calculator")] },
      { title: "Get the eCAR and transfer the title", detail: "Present the eCAR to the Registry of Deeds; pay local transfer tax.", links: [] },
    ],
  },
  {
    slug: "donate-property",
    title: "Donating property",
    summary: "Donor's tax, documentary stamp tax where applicable, and transfer.",
    needs_verification: true,
    steps: [
      { title: "Compute donor's tax", detail: "6% of total gifts in the calendar year above the ₱250,000 exemption, less donor's tax already paid that year.", links: [calc("donors", "Donor's tax calculator")] },
      { title: "File and pay donor's tax", detail: "BIR Form 1800.", deadline: "Within 30 days after the date of the gift", form_code: "1800", legal_basis: "NIRC Sec. 103", links: [] },
      { title: "Transfer the property", detail: "For real property, get the eCAR and register the transfer.", links: [] },
    ],
  },
  {
    slug: "transfer-rdo",
    title: "Moving to another RDO",
    summary: "Updating your registration when you move your residence or business address.",
    needs_verification: true,
    steps: [
      { title: "File for transfer of registration", detail: "Submit BIR Form 1905 (online through ORUS where available, or with your current RDO).", form_code: "1905", legal_basis: "NIRC Sec. 236(B), as amended by RA 11976; RR 7-2024 (to confirm)", links: [] },
      { title: "Update your other registrations", detail: "Business permit at the new LGU, DTI/SEC address change, and your profile here.", links: [{ label: "Update your profile", href: "/profile" }] },
      { title: "Check your new RDO's requirements", detail: "Some RDOs require the new COR to be posted and books re-registered (to confirm).", links: [] },
    ],
  },
];

export function getLifeEvent(slug: string): LifeEvent | undefined {
  return lifeEvents.find((e) => e.slug === slug);
}
