import { Suspense } from "react";
import { AdminIssuanceList } from "./list";

export default function Page() {
  return (
    <Suspense>
      <AdminIssuanceList />
    </Suspense>
  );
}
