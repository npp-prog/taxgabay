import { DEFAULT_PROFILE, hasBusiness, isIndividual, type Profile } from "@taxgabay/tax-engine";
import { useRouter } from "expo-router";
import * as React from "react";
import { Text } from "react-native";
import { Button, Card, Choice, Screen, Title, Toggle } from "../../src/ui/components";
import { useTheme } from "../../src/ui/theme";
import { useStore } from "../../src/store/StoreProvider";

const TYPES: { value: Profile["taxpayer_type"]; label: string; hint?: string }[] = [
  { value: "employee", label: "Employee only" },
  { value: "self_employed", label: "Self-employed or professional", hint: "Freelancer, doctor, lawyer, CPA, consultant…" },
  { value: "mixed_income", label: "Employee with a side business", hint: "Salary plus business or professional income" },
  { value: "sole_proprietorship", label: "Sole proprietor (DTI)" },
  { value: "partnership", label: "Partnership (SEC)" },
  { value: "corporation", label: "Corporation (SEC)" },
  { value: "opc", label: "One Person Corporation (SEC)" },
  { value: "cooperative", label: "Cooperative (CDA)" },
  { value: "estate", label: "Heir or estate administrator" },
  { value: "one_time", label: "One-time transaction", hint: "Selling property, donating, selling shares" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { state, saveProfile } = useStore();
  const [edited, setEdited] = React.useState<Profile | null>(null);
  const p = edited ?? state.profile ?? DEFAULT_PROFILE;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setEdited({ ...p, [k]: v });
  const business = hasBusiness(p.taxpayer_type);
  const individual = isIndividual(p.taxpayer_type);

  return (
    <Screen>
      <Title sub="Stored only on this phone. We never ask for your TIN.">Your taxpayer profile</Title>
      <Card>
        <Choice label="Which best describes you?" value={p.taxpayer_type} options={TYPES} onChange={(v) => set("taxpayer_type", v)} />
      </Card>
      {business && (
        <Card>
          <Choice
            label="Are you VAT-registered?"
            value={p.vat_status}
            options={[
              { value: "non_vat", label: "No — non-VAT (percentage tax)" },
              { value: "vat", label: "Yes — VAT-registered" },
              { value: "not_sure", label: "Not sure / not registered yet", hint: "Check your Certificate of Registration (Form 2303)" },
            ]}
            onChange={(v) => set("vat_status", v)}
          />
          {individual && (
            <Choice
              label="Income tax option"
              value={p.income_tax_option}
              options={[
                { value: "eight_percent", label: "8% on gross sales/receipts" },
                { value: "graduated_osd", label: "Graduated rates with 40% OSD" },
                { value: "graduated_itemized", label: "Graduated rates with itemized deductions" },
                { value: "not_sure", label: "Not sure yet", hint: "Compare them in Calculators" },
              ]}
              onChange={(v) => set("income_tax_option", v)}
            />
          )}
          <Toggle label="I have employees" value={p.has_employees} onChange={(v) => set("has_employees", v)} />
          <Toggle label="I withhold tax on rent, professional fees or contractors" value={p.withholds_expanded} onChange={(v) => set("withholds_expanded", v)} />
          <Choice
            label="How do you file?"
            value={p.filing_channel}
            options={[
              { value: "ebirforms", label: "eBIRForms" },
              { value: "efps", label: "eFPS" },
              { value: "not_sure", label: "Not sure" },
            ]}
            onChange={(v) => set("filing_channel", v)}
          />
          {p.filing_channel === "efps" && (
            <Choice
              label="eFPS group"
              value={p.efps_group ?? "A"}
              options={(["A", "B", "C", "D", "E"] as const).map((g) => ({ value: g, label: `Group ${g}` }))}
              onChange={(v) => set("efps_group", v)}
            />
          )}
          {!individual && (
            <Choice
              label="Taxable year ends in"
              value={p.fiscal_year_end_month}
              options={MONTHS.map((m, i) => ({ value: i + 1, label: i === 11 ? `${m} (calendar year)` : m }))}
              onChange={(v) => set("fiscal_year_end_month", v)}
            />
          )}
          <Choice
            label="Expected gross annual sales"
            value={p.taxpayer_size}
            options={[
              { value: "micro", label: "Below ₱3 million (micro)" },
              { value: "small", label: "₱3 million to below ₱20 million (small)" },
              { value: "medium", label: "₱20 million to below ₱1 billion (medium)" },
              { value: "large", label: "₱1 billion or more (large)" },
              { value: "not_sure", label: "Not sure" },
            ]}
            onChange={(v) => set("taxpayer_size", v)}
          />
        </Card>
      )}
      <Button
        label="Save and see my calendar"
        onPress={() => {
          saveProfile(p);
          setEdited(null);
          router.push("/calendar");
        }}
      />
      <Text style={{ color: t.muted, fontSize: 12 }}>Size thresholds and tax options are pending CPA verification.</Text>
    </Screen>
  );
}
