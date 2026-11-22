import type { Metadata } from "next";
import { Suspense } from "react";
import { buildSearchIndex } from "@/lib/search-index";
import { SearchView } from "./search-view";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  const docs = buildSearchIndex();
  return (
    <Suspense>
      <SearchView docs={docs} />
    </Suspense>
  );
}
