import type { Metadata } from "next";
import { Suspense } from "react";
import { IssuanceLibrary } from "./library";

export const metadata: Metadata = { title: "BIR issuances library" };

export default function IssuancesPage() {
  return (
    <Suspense>
      <IssuanceLibrary />
    </Suspense>
  );
}
