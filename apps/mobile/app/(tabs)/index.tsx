import { Link } from "expo-router";
import { Text } from "react-native";
import { Card, Disclaimer, Screen, Title } from "../../src/ui/components";
import { useTheme } from "../../src/ui/theme";
import { useStore } from "../../src/store/StoreProvider";

export default function Home() {
  const t = useTheme();
  const { state } = useStore();
  const items = [
    { href: "/profile" as const, title: state.profile ? "Update your profile" : "Start your profile", body: "A few questions about your work or business decide which returns apply to you." },
    { href: "/calendar" as const, title: "Your tax calendar", body: "Deadlines for the next 12 months, moved to the next working day for weekends and holidays." },
    { href: "/calculators" as const, title: "Calculators", body: "8% vs graduated income tax, percentage tax, VAT and late-payment penalties — every line explained." },
  ];
  return (
    <Screen>
      <Title sub="Tell us who you are, and we'll tell you what BIR expects from you — when, and how much.">TaxGabay</Title>
      {items.map((i) => (
        <Link key={i.href} href={i.href} accessibilityRole="link" accessibilityLabel={i.title}>
          <Card style={{ width: "100%" }}>
            <Text style={{ color: t.text, fontWeight: "700", fontSize: 16 }}>{i.title}</Text>
            <Text style={{ color: t.muted }}>{i.body}</Text>
          </Card>
        </Link>
      ))}
      <Text style={{ color: t.muted, fontSize: 13 }}>
        Your answers stay on this phone. TaxGabay explains and computes; it does not file for you — file on eBIRForms, eFPS or ORUS.
      </Text>
      <Disclaimer verified={false} />
    </Screen>
  );
}
