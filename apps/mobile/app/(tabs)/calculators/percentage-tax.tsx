import * as React from "react";
import { runPercentageTax, type CalcOutcome } from "../../../src/calc/models";
import { todayPH } from "../../../src/lib/dates";
import { Button, Card, Choice, ErrorText, Field, Screen, Title } from "../../../src/ui/components";
import { ResultView } from "../../../src/ui/ResultView";

export default function PercentageTaxScreen() {
  const today = todayPH();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = React.useState(thisYear);
  const [quarter, setQuarter] = React.useState(Math.ceil(Number(today.slice(5, 7)) / 3));
  const [gross, setGross] = React.useState("");
  const [out, setOut] = React.useState<CalcOutcome | null>(null);
  return (
    <Screen>
      <Title sub="For non-VAT taxpayers who did not elect the 8% income tax option (2551Q).">Quarterly percentage tax</Title>
      <Card>
        <Choice label="Year" value={year} options={[thisYear, thisYear - 1, thisYear - 2, thisYear - 3].map((y) => ({ value: y, label: String(y) }))} onChange={setYear} />
        <Choice label="Quarter" value={quarter} options={[1, 2, 3, 4].map((q) => ({ value: q, label: `Q${q}` }))} onChange={setQuarter} />
        <Field label="Gross sales/receipts for the quarter" value={gross} onChangeText={setGross} />
        <Button label="Compute" onPress={() => setOut(runPercentageTax({ year, quarter, gross }))} />
      </Card>
      {out && !out.ok && <ErrorText>{out.error}</ErrorText>}
      {out && out.ok && <ResultView view={out.view} />}
    </Screen>
  );
}
