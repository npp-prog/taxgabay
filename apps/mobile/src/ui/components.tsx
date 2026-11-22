import type { Step } from "@taxgabay/tax-engine";
import { peso } from "@taxgabay/tax-engine";
import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type ViewStyle } from "react-native";
import { useTheme } from "./theme";

export const DISCLAIMER = "For guidance only. Verify with BIR issuances or consult a CPA.";

export function Screen({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
        {children}
      </Text>
      {sub ? <Text style={{ color: t.muted, fontSize: 15, lineHeight: 21 }}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontWeight: "600", fontSize: 14 }}>{children}</Text>;
}

export function Field({
  label,
  value,
  onChangeText,
  hint,
  placeholder,
  money = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  hint?: string;
  placeholder?: string;
  money?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? (money ? "₱0.00" : undefined)}
        placeholderTextColor={t.muted}
        keyboardType={money ? "decimal-pad" : "default"}
        autoCorrect={false}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      />
      {hint ? <Text style={{ color: t.muted, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

export function Choice<V extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: { value: V; label: string; hint?: string }[];
  onChange: (v: V) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Label>{label}</Label>
      <View style={{ gap: 6 }}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[styles.choice, { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.soft : t.card }]}
            >
              <Text style={{ color: t.text, fontWeight: selected ? "600" : "400" }}>{o.label}</Text>
              {o.hint ? <Text style={{ color: t.muted, fontSize: 12 }}>{o.hint}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: t.text, flex: 1, fontSize: 15 }}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: t.primary, false: t.border }} />
    </View>
  );
}

export function Button({ label, onPress, variant = "primary" }: { label: string; onPress: () => void; variant?: "primary" | "outline" }) {
  const t = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: primary ? t.primary : "transparent", borderColor: t.primary, opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={{ color: primary ? t.onPrimary : t.primary, fontWeight: "600", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="alert" style={{ color: t.error }}>
      {children}
    </Text>
  );
}

export function Disclaimer({ verified }: { verified: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.warnBg, borderColor: t.warnBg }]}>
      <Text style={{ color: t.warnText, fontWeight: "600" }}>{DISCLAIMER}</Text>
      <Text style={{ color: t.warnText, marginTop: 4 }}>
        {verified ? "Last verified by our CPA." : "Last verified: not yet — rates and dates are awaiting CPA review."}
      </Text>
    </View>
  );
}

export function StepsList({ steps }: { steps: readonly Step[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }} accessibilityLabel="How this was computed">
      <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>How this was computed</Text>
      {steps.map((s, i) => (
        <View key={i} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border, paddingTop: 8, gap: 2 }}>
          <View style={styles.row}>
            <Text style={{ color: t.text, flex: 1, fontWeight: "600" }}>{s.label}</Text>
            <Text style={{ color: t.text, fontVariant: ["tabular-nums"], fontWeight: "600" }}>{peso(s.amount)}</Text>
          </View>
          <Text style={{ color: t.muted, fontFamily: "monospace", fontSize: 12 }}>{s.formula}</Text>
          {s.legal_basis ? <Text style={{ color: t.muted, fontSize: 12 }}>Basis: {s.legal_basis}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "warn" | "ok" }) {
  const t = useTheme();
  const bg = tone === "warn" ? t.warnBg : tone === "ok" ? t.soft : t.bg;
  const fg = tone === "warn" ? t.warnText : tone === "ok" ? t.okText : t.muted;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "600" }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  choice: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
});
