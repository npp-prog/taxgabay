import { Suspense } from "react";
import { IssuanceEditor } from "./editor";

export default function Page() {
  return (
    <Suspense>
      <IssuanceEditor />
    </Suspense>
  );
}
