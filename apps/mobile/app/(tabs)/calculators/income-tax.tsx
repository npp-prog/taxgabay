import * as React from "react";
import { runIncomeTax, type CalcOutcome } from "../../../src/calc/models";
import { todayPH } from "../../../src/lib/dates";
import { Button, Card, Choice, ErrorText, Field, Screen, Title, Toggle } from "../../../src/ui/components";
import { ResultView } from "../../../src/ui/ResultView";

export default function IncomeTaxScreen() {
  const thisYear = Number(todayPH().slice(0, 4));
  const [year, setYear] = React.useState(thisYear);
  const [gross, setGross] = React.useState("");
  const [comp, setComp] = React.useState("");
  const [itemized, setItemized] = React.useState("");
  const [vat, setVat] = React.useState(false);
  const [out, setOut] = React.useState<CalcOutcome | null>(null);
  const years = [thisYear, thisYear - 1, thisYear - 2];
  return (
    <Screen>
      <Title sub="Annual figures. Totals include percentage tax under graduated rates for non-VAT taxpayers, since the 8% option replaces it.">8% vs graduated rates</Title>
      <Card>
        <Choice label="Taxable year" value={year} options={years.map((y) => ({ value: y, label: String(y) }))} onChange={setYear} />
        <Field label="Gross sales or receipts" value={gross} onChangeText={setGross} hint="Net of returns, allowances and discounts" />
        <Field label="Taxable compensation income (if employed)" value={comp} onChangeText={setComp} hint="From your Form 2316" />
        <Field label="Itemized deductions (optional)" value={itemized} onChangeText={setItemized} hint="Leave blank to skip" />
        <Toggle label="I am VAT-registered" value={vat} onChange={setVat} />
        <Button label="Compute" onPress={() => setOut(runIncomeTax({ year, gross, comp, itemized, vat }))} />
      </Card>
      {out && !out.ok && <ErrorText>{out.error}</ErrorText>}
      {out && out.ok && <ResultView view={out.view} />}
    </Screen>
  );
}
