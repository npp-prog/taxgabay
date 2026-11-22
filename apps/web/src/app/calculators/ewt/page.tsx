import type { Metadata } from "next";
import { EwtCalculator } from "./calculator";

export const metadata: Metadata = { title: "Expanded withholding tax calculator" };

export default function Page() {
  return <EwtCalculator />;
}
