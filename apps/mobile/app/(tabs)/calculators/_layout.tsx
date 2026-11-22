import { Stack } from "expo-router";
import { useTheme } from "../../../src/ui/theme";

export default function CalculatorsLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: t.card }, headerTintColor: t.text }}>
      <Stack.Screen name="index" options={{ title: "Calculators" }} />
      <Stack.Screen name="income-tax" options={{ title: "Income tax" }} />
      <Stack.Screen name="percentage-tax" options={{ title: "Percentage tax" }} />
      <Stack.Screen name="vat" options={{ title: "VAT" }} />
      <Stack.Screen name="penalty" options={{ title: "Penalties" }} />
    </Stack>
  );
}
