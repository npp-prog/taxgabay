import type { Metadata } from "next";
import { PenaltyCalculator } from "./calculator";

export const metadata: Metadata = { title: "Penalty calculator" };

export default function Page() {
  return <PenaltyCalculator />;
}
