import type { Metadata } from "next";
import { PrepareView } from "./prepare-view";

export const metadata: Metadata = { title: "Prepare my BIR documents" };

export default function PreparePage() {
  return <PrepareView />;
}
