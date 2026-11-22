import { Link } from "expo-router";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { calendarFor } from "../../src/calendar";
import { formatDate, formatMonth, todayPH } from "../../src/lib/dates";
import { useStore } from "../../src/store/StoreProvider";
import { Badge, Card, Disclaimer, Screen, Title } from "../../src/ui/components";
import { useTheme } from "../../src/ui/theme";

export default function CalendarScreen() {
  const t = useTheme();
  const { state, ready, toggleObligation } = useStore();
  const today = todayPH();
  const groups = React.useMemo(() => (state.profile ? calendarFor(state.profile, today) : []), [state.profile, today]);

  if (!ready) return <Screen><Text style={{ color: t.muted }}>Loading…</Text></Screen>;
  if (!state.profile) {
    return (
      <Screen>
        <Title sub="Your deadlines for the next 12 months.">Tax calendar</Title>
        <Link href="/profile" accessibilityRole="link">
          <Text style={{ color: t.primary, fontWeight: "600" }}>Start your profile first →</Text>
        </Link>
      </Screen>
    );
  }
  return (
    <Screen>
      <Title sub="Weekend and holiday deadlines move to the next working day. Tick a return once it is filed and paid.">Tax calendar</Title>
      {groups.length === 0 && <Text style={{ color: t.muted }}>No BIR returns to file based on your profile.</Text>}
      {groups.map((g) => (
        <View key={g.month} style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontWeight: "700", fontSize: 17 }}>
            {formatMonth(g.month)}
          </Text>
          {g.items.map((o) => {
            const done = state.obligations[o.id] === "filed_and_paid";
            const overdue = !done && o.due_date < today;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={`BIR ${o.form_code} for ${o.period_label}, due ${formatDate(o.due_date)}. ${done ? "Filed and paid" : "Not yet filed"}`}
                onPress={() => toggleObligation(o.id)}
              >
                <Card style={{ opacity: done ? 0.6 : 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text style={{ fontSize: 20, color: done ? t.okText : t.muted }}>{done ? "☑" : "☐"}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: t.text, fontWeight: "700" }}>
                        {o.form_code} · {o.period_label}
                      </Text>
                      <Text style={{ color: t.muted, fontSize: 13 }}>{o.title}</Text>
                      <Text style={{ color: t.text, fontSize: 13 }}>Due {formatDate(o.due_date)}</Text>
                      {o.adjustments.map((a) => (
                        <Text key={a} style={{ color: t.muted, fontSize: 12 }}>
                          {a}
                        </Text>
                      ))}
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        {o.tentative && <Badge tone="warn">Depends on your answers</Badge>}
                        {overdue && <Badge tone="warn">Overdue</Badge>}
                        {done && <Badge tone="ok">Filed & paid</Badge>}
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Disclaimer verified={false} />
    </Screen>
  );
}
