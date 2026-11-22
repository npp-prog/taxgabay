import type { PracticeSet } from "../practice";
import { corporationSet } from "./corporation";
import { freelanceSet } from "./freelance";
import { sariSariSet } from "./sari-sari";
import { vatBusinessSet } from "./vat-business";

export const practiceSets: PracticeSet[] = [freelanceSet, sariSariSet, vatBusinessSet, corporationSet];

export function getPracticeSet(slug: string) {
  return practiceSets.find((s) => s.slug === slug);
}
