import type { Metadata } from "next";
import { AccountView } from "./account-view";

export const metadata: Metadata = { title: "Account and data" };

export default function AccountPage() {
  return <AccountView />;
}
