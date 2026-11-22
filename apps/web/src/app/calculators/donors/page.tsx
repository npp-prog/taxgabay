import type { Metadata } from "next";
import { DonorsCalculator } from "./calculator";

export const metadata: Metadata = { title: "Donor's tax calculator" };

export default function Page() {
  return <DonorsCalculator />;
}
