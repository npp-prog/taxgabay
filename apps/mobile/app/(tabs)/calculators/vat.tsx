import * as React from "react";
import { runVat, type CalcOutcome } from "../../../src/calc/models";
import { todayPH } from "../../../src/lib/dates";
import { Button, Card, Choice, ErrorText, Field, Screen, Title, Toggle } from "../../../src/ui/components";
import { ResultView } from "../../../src/ui/ResultView";

export default function VatScreen() {
  const today = todayPH();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = React.useState(thisYear);
  const [quarter, setQuarter] = React.useState(Math.ceil(Number(today.slice(5, 7)) / 3));
  const [sales, setSales] = React.useState("");
  const [salesInclusive, setSalesInclusive] = React.useState(true);
  const [purchases, setPurchases] = React.useState("");
  const [purchasesInclusive, setPurchasesInclusive] = React.useState(true);
  const [carried, setCarried] = React.useState("");
  const [out, setOut] = React.useState<CalcOutcome | null>(null);
  return (
    <Screen>
      <Title sub="Output VAT on your sales less input VAT on your purchases (2550Q).">Quarterly VAT</Title>
      <Card>
        <Choice label="Year" value={year} options={[thisYear, thisYear - 1, thisYear - 2].map((y) => ({ value: y, label: String(y) }))} onChange={setYear} />
        <Choice label="Quarter" value={quarter} options={[1, 2, 3, 4].map((q) => ({ value: q, label: `Q${q}` }))} onChange={setQuarter} />
        <Field label="Vatable sales" value={sales} onChangeText={setSales} />
        <Toggle label="Sales amount already includes VAT" value={salesInclusive} onChange={setSalesInclusive} />
        <Field label="Vatable purchases" value={purchases} onChangeText={setPurchases} />
        <Toggle label="Purchases amount already includes VAT" value={purchasesInclusive} onChange={setPurchasesInclusive} />
        <Field label="Excess input VAT from last quarter (optional)" value={carried} onChangeText={setCarried} />
        <Button label="Compute" onPress={() => setOut(runVat({ year, quarter, sales, salesInclusive, purchases, purchasesInclusive, carried }))} />
      </Card>
      {out && !out.ok && <ErrorText>{out.error}</ErrorText>}
      {out && out.ok && <ResultView view={out.view} />}
    </Screen>
  );
}
