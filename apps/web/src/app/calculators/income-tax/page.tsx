import type { Metadata } from "next";
import { IncomeTaxCalculator } from "./calculator";

export const metadata: Metadata = { title: "Income tax calculator: 8% vs graduated" };

export default function Page() {
  return <IncomeTaxCalculator />;
}
