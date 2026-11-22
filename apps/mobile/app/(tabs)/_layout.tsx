import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useTheme } from "../../src/ui/theme";

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("⌂") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("☺") }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar", tabBarIcon: icon("▦") }} />
      <Tabs.Screen name="calculators" options={{ title: "Calculators", headerShown: false, tabBarIcon: icon("∑") }} />
    </Tabs>
  );
}
