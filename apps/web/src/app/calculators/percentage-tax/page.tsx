import type { Metadata } from "next";
import { PercentageTaxCalculator } from "./calculator";

export const metadata: Metadata = { title: "Percentage tax calculator" };

export default function Page() {
  return <PercentageTaxCalculator />;
}
