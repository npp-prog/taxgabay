import type { Metadata } from "next";
import { ChecklistsView } from "./checklists-view";

export const metadata: Metadata = { title: "Compliance checklists" };

export default function ChecklistsPage() {
  return <ChecklistsView />;
}
