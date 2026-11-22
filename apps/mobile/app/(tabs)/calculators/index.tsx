import { Link } from "expo-router";
import { Text } from "react-native";
import { Card, Screen } from "../../../src/ui/components";
import { useTheme } from "../../../src/ui/theme";

const CALCS = [
  { href: "/calculators/income-tax" as const, title: "Income tax: 8% vs graduated", body: "For self-employed, professionals and mixed-income earners." },
  { href: "/calculators/percentage-tax" as const, title: "Percentage tax", body: "Quarterly, for non-VAT taxpayers (2551Q)." },
  { href: "/calculators/vat" as const, title: "VAT", body: "Output VAT less input VAT for the quarter (2550Q)." },
  { href: "/calculators/penalty" as const, title: "Late filing/payment penalty", body: "Surcharge, interest and compromise penalty." },
];

export default function CalculatorList() {
  const t = useTheme();
  return (
    <Screen>
      {CALCS.map((c) => (
        <Link key={c.href} href={c.href} accessibilityRole="link" accessibilityLabel={c.title}>
          <Card style={{ width: "100%" }}>
            <Text style={{ color: t.text, fontWeight: "700", fontSize: 16 }}>{c.title}</Text>
            <Text style={{ color: t.muted }}>{c.body}</Text>
          </Card>
        </Link>
      ))}
      <Text style={{ color: t.muted, fontSize: 13 }}>Every result shows the step-by-step computation and the legal basis for each line.</Text>
    </Screen>
  );
}
