import type { PracticeSet } from "../practice";
import { freelanceSet } from "./freelance";

export const practiceSets: PracticeSet[] = [freelanceSet];

export function getPracticeSet(slug: string): PracticeSet | undefined {
  return practiceSets.find((s) => s.slug === slug);
}
