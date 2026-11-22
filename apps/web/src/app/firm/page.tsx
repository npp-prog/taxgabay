import type { Metadata } from "next";
import { FirmWorkspace } from "./firm-workspace";

export const metadata: Metadata = { title: "Firm workspace", robots: { index: false } };

export default function FirmPage() {
  return <FirmWorkspace />;
}
