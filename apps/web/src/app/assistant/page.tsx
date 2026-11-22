import type { Metadata } from "next";
import { AssistantView } from "./assistant-view";

export const metadata: Metadata = { title: "Ask TaxGabay" };

export default function AssistantPage() {
  return <AssistantView />;
}
