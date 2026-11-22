export interface RegistrationStep {
  id: string;
  business_form: "dti" | "sec" | "cda";
  order: number;
  agency: string;
  title: string;
  summary: string;
  requirements: string[];
  where: string;
  online_link: string | null;
  fees_note: string;
  est_days: string;
  legal_basis: string;
  /** Only shown when the profile has employees. */
  only_if_employees?: boolean;
  needs_verification: boolean;
}

/** Sole proprietorship roadmap (Phase 1). SEC and CDA paths are Phase 2. */
export const registrationSteps: RegistrationStep[] = [
  {
    id: "dti-bn",
    business_form: "dti",
    order: 1,
    agency: "DTI",
    title: "Register your business name with the DTI",
    summary: "A sole proprietorship uses a DTI-registered business name. Check availability and register online.",
    requirements: ["One valid government-issued ID", "Proposed business name (with alternates)", "Territorial scope (barangay, city/municipality, regional or national)"],
    where: "DTI Business Name Registration System (online) or a DTI Negosyo Center",
    online_link: "https://bnrs.dti.gov.ph/",
    fees_note: "Fee depends on territorial scope (from about ₱200 for barangay to ₱2,000 for national) plus ₱30 documentary stamp tax. Registration is valid for 5 years.",
    est_days: "Same day (online)",
    legal_basis: "Act No. 3883 (Business Name Law), as amended; DTI Department Administrative Order on BNRS (number to confirm)",
    needs_verification: true,
  },
  {
    id: "brgy",
    business_form: "dti",
    order: 2,
    agency: "Barangay",
    title: "Get a barangay business clearance",
    summary: "The barangay where your business operates issues a clearance needed for the mayor's permit.",
    requirements: ["DTI business name certificate", "Valid ID", "Proof of business address (lease contract or land title/tax declaration)", "Community tax certificate (cedula), if required"],
    where: "Barangay hall where the business is located",
    online_link: null,
    fees_note: "Set by barangay ordinance; varies.",
    est_days: "1–3 days",
    legal_basis: "RA 7160 (Local Government Code) Sec. 152(c)",
    needs_verification: true,
  },
  {
    id: "mayors-permit",
    business_form: "dti",
    order: 3,
    agency: "City/Municipal Hall (BPLO)",
    title: "Secure your mayor's / business permit",
    summary: "Apply at the Business Permits and Licensing Office. Many LGUs have a one-stop business center or online portal.",
    requirements: ["Barangay clearance", "DTI certificate", "Proof of business address", "Fire safety inspection, sanitary permit, zoning/locational clearance (as required by the LGU)"],
    where: "Business Permits and Licensing Office (BPLO) of the city or municipality",
    online_link: null,
    fees_note: "Local business tax and regulatory fees set by the LGU's revenue code; based on capitalization for new businesses.",
    est_days: "Up to 3 working days for simple transactions under the Ease of Doing Business Act (may be longer in practice)",
    legal_basis: "RA 7160 Secs. 143 and 444; RA 11032 (Ease of Doing Business Act)",
    needs_verification: true,
  },
  {
    id: "bir-1901",
    business_form: "dti",
    order: 4,
    agency: "BIR",
    title: "Register with the BIR (Form 1901) and get your COR",
    summary:
      "Register as a self-employed individual before you start operating. You will receive a Certificate of Registration (Form 2303) showing your tax types and filing obligations. Choose the 8% option here or in your first quarterly return if you qualify.",
    requirements: [
      "BIR Form 1901",
      "Valid government-issued ID (and TIN if you already have one from employment)",
      "DTI certificate",
      "Mayor's permit, or proof of application",
      "Proof of business address",
    ],
    where: "Online Registration and Update System (ORUS), or the RDO with jurisdiction over your business address",
    online_link: "https://orus.bir.gov.ph/",
    fees_note: "The ₱500 annual registration fee was abolished by the Ease of Paying Taxes Act. Pay ₱30 documentary stamp tax where applicable (to confirm).",
    est_days: "1–3 days (varies by RDO)",
    legal_basis: "NIRC Sec. 236, as amended by RA 11976 (EOPT); RR 7-2024 and RR 8-2024 (to confirm)",
    needs_verification: true,
  },
  {
    id: "bir-books",
    business_form: "dti",
    order: 5,
    agency: "BIR",
    title: "Register your books of accounts",
    summary: "Register manual, loose-leaf or computerized books. Small taxpayers may keep simplified books.",
    requirements: ["Certificate of Registration (Form 2303)", "Books to be registered (journal and ledger, or as allowed for your size)"],
    where: "ORUS or your RDO",
    online_link: "https://orus.bir.gov.ph/",
    fees_note: "No BIR fee.",
    est_days: "Same day to a few days",
    legal_basis: "NIRC Sec. 232; RR 9-2009 (to confirm)",
    needs_verification: true,
  },
  {
    id: "bir-invoices",
    business_form: "dti",
    order: 6,
    agency: "BIR",
    title: "Set up invoicing (Authority to Print or e-invoicing)",
    summary:
      "Under the Ease of Paying Taxes Act, the sales invoice is the primary document for both sales of goods and services (official receipts are now supplementary). Get an Authority to Print from an accredited printer or register your invoicing system.",
    requirements: ["Certificate of Registration (Form 2303)", "Accredited printer's ATP application, or registration of your computerized/e-invoicing system"],
    where: "ORUS / BIR accredited printer",
    online_link: "https://orus.bir.gov.ph/",
    fees_note: "Printer charges vary.",
    est_days: "Several days to weeks (printing)",
    legal_basis: "NIRC Secs. 113 and 237, as amended by RA 11976 (EOPT); RR 7-2024",
    needs_verification: true,
  },
  {
    id: "bir-posting",
    business_form: "dti",
    order: 7,
    agency: "BIR",
    title: "Post your COR and \"Ask for an invoice\" notice",
    summary: "Display your Certificate of Registration and the notice reminding customers to ask for an invoice at your place of business.",
    requirements: ["Certificate of Registration (Form 2303)", "\"Ask for invoice\" notice (from BIR)"],
    where: "Your place of business, visible to customers",
    online_link: null,
    fees_note: "None.",
    est_days: "Same day",
    legal_basis: "NIRC Sec. 236; RR 7-2024 (to confirm)",
    needs_verification: true,
  },
  {
    id: "employer-reg",
    business_form: "dti",
    order: 8,
    agency: "SSS, PhilHealth, Pag-IBIG",
    title: "Register as an employer (if you hire employees)",
    summary: "Register with SSS, PhilHealth and Pag-IBIG before or upon hiring, and report each employee.",
    requirements: ["DTI certificate and mayor's permit", "BIR COR", "Employer registration forms (SSS R-1, PhilHealth ER1, Pag-IBIG Employer's Data Form)", "List of employees"],
    where: "Online portals or branches of each agency",
    online_link: "https://www.sss.gov.ph/",
    fees_note: "No registration fee; monthly contributions apply.",
    est_days: "1–5 days per agency",
    legal_basis: "RA 11199 (Social Security Act of 2018); RA 11223 (Universal Health Care Act); RA 9679 (HDMF Law of 2009)",
    only_if_employees: true,
    needs_verification: true,
  },
];
