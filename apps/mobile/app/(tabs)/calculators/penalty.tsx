import * as React from "react";
import { runPenalty, type CalcOutcome } from "../../../src/calc/models";
import { todayPH } from "../../../src/lib/dates";
import { useStore } from "../../../src/store/StoreProvider";
import { Button, Card, Choice, ErrorText, Field, Screen, Title, Toggle } from "../../../src/ui/components";
import { ResultView } from "../../../src/ui/ResultView";

type Size = "micro" | "small" | "medium" | "large";

export default function PenaltyScreen() {
  const { state } = useStore();
  const profileSize = state.profile?.taxpayer_size;
  const [sizeOverride, setSize] = React.useState<Size | null>(null);
  const size: Size = sizeOverride ?? (profileSize && profileSize !== "not_sure" ? profileSize : "micro");
  const [due, setDue] = React.useState("");
  const [paid, setPaid] = React.useState(todayPH());
  const [basic, setBasic] = React.useState("");
  const [lateFiling, setLateFiling] = React.useState(true);
  const [latePayment, setLatePayment] = React.useState(true);
  const [willful, setWillful] = React.useState(false);
  const [compromise, setCompromise] = React.useState(true);
  const [out, setOut] = React.useState<CalcOutcome | null>(null);
  return (
    <Screen>
      <Title sub="Surcharge, interest and the suggested compromise penalty, with reduced rates for micro and small taxpayers.">Late filing and payment</Title>
      <Card>
        <Choice
          label="Taxpayer size"
          value={size}
          options={[
            { value: "micro", label: "Micro (below ₱3M)" },
            { value: "small", label: "Small (₱3M to below ₱20M)" },
            { value: "medium", label: "Medium (₱20M to below ₱1B)" },
            { value: "large", label: "Large (₱1B and up)" },
          ]}
          onChange={setSize}
        />
        <Field label="Original due date" value={due} onChangeText={setDue} money={false} placeholder="YYYY-MM-DD" />
        <Field label="Actual or planned payment date" value={paid} onChangeText={setPaid} money={false} placeholder="YYYY-MM-DD" />
        <Field label="Basic tax due" value={basic} onChangeText={setBasic} />
        <Toggle label="Return filed late (or not yet filed)" value={lateFiling} onChange={setLateFiling} />
        <Toggle label="Tax paid late (or not yet paid)" value={latePayment} onChange={setLatePayment} />
        <Toggle label="Willful neglect or false return (50%)" value={willful} onChange={setWillful} />
        <Toggle label="Include suggested compromise penalty" value={compromise} onChange={setCompromise} />
        <Button label="Compute" onPress={() => setOut(runPenalty({ due, paid, basic, size, lateFiling, latePayment, willful, compromise }))} />
      </Card>
      {out && !out.ok && <ErrorText>{out.error}</ErrorText>}
      {out && out.ok && <ResultView view={out.view} />}
    </Screen>
  );
}
