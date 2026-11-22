import type { Metadata } from "next";
import { EstateCalculator } from "./calculator";

export const metadata: Metadata = { title: "Estate tax calculator" };

export default function Page() {
  return <EstateCalculator />;
}
