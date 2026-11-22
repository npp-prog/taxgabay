import type { Metadata } from "next";
import { ProfileSummaryView } from "./summary-view";

export const metadata: Metadata = { title: "What applies to you" };

export default function SummaryPage() {
  return <ProfileSummaryView />;
}
