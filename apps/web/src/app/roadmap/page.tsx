import type { Metadata } from "next";
import { RoadmapView } from "./roadmap-view";

export const metadata: Metadata = { title: "Business registration roadmap" };

export default function RoadmapPage() {
  return <RoadmapView />;
}
