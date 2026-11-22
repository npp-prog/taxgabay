import type { Metadata } from "next";
import { CgtCalculator } from "./calculator";

export const metadata: Metadata = { title: "Capital gains tax calculator" };

export default function Page() {
  return <CgtCalculator />;
}
