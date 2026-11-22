import type { Metadata } from "next";
import { WithholdingCompensationCalculator } from "./calculator";

export const metadata: Metadata = { title: "Withholding tax on compensation calculator" };

export default function Page() {
  return <WithholdingCompensationCalculator />;
}
