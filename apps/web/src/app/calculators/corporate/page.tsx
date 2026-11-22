import type { Metadata } from "next";
import { CorporateCalculator } from "./calculator";

export const metadata: Metadata = { title: "Corporate income tax calculator" };

export default function Page() {
  return <CorporateCalculator />;
}
