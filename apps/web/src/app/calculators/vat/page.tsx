import type { Metadata } from "next";
import { VatCalculator } from "./calculator";

export const metadata: Metadata = { title: "VAT calculator" };

export default function Page() {
  return <VatCalculator />;
}
