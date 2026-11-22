import "server-only";
import { join } from "node:path";
import { getGuide as get, listGuides as list } from "@taxgabay/content";

// Guides are read at build time (static generation), relative to the web app directory.
const DIR = join(process.cwd(), "..", "..", "packages", "content", "guides");

export const listGuides = () => list(DIR);
export const getGuide = (slug: string) => get(slug, DIR);
