import type { Metadata } from "next";
import { ProfileWizard } from "./wizard";

export const metadata: Metadata = { title: "My taxpayer profile" };

export default function ProfilePage() {
  return <ProfileWizard />;
}
