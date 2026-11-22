import * as React from "react";
import { Text, View } from "react-native";
import type { CalcView } from "../calc/models";
import { Card, Disclaimer, StepsList } from "./components";
import { useTheme } from "./theme";

export function ResultView({ view }: { view: CalcView }) {
  const t = useTheme();
  return (
    <View style={{ gap: 16 }} accessibilityLiveRegion="polite">
      <Card style={{ backgroundColor: t.soft, borderColor: t.soft }}>
        {view.subline ? <Text style={{ color: t.text }}>{view.subline}</Text> : null}
        <Text accessibilityLabel={`Result ${view.headline}`} style={{ color: t.text, fontSize: 28, fontWeight: "700" }}>
          {view.headline}
        </Text>
      </Card>
      {view.extra ? (
        <Card>
          {view.extra.map((x) => (
            <View key={x.label} style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: t.text, flex: 1 }}>{x.label}</Text>
                <Text style={{ color: t.text, fontWeight: "600" }}>{x.value}</Text>
              </View>
              {x.note ? <Text style={{ color: t.muted, fontSize: 12 }}>{x.note}</Text> : null}
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <StepsList steps={view.steps} />
      </Card>
      {view.warnings.map((w) => (
        <Text key={w} style={{ color: t.muted, fontSize: 13 }}>
          • {w}
        </Text>
      ))}
      <Disclaimer verified={view.verified} />
    </View>
  );
}
