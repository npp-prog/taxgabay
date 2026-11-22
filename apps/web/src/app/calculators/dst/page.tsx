import type { Metadata } from "next";
import { DstCalculator } from "./calculator";

export const metadata: Metadata = { title: "Documentary stamp tax calculator" };

export default function Page() {
  return <DstCalculator />;
}
