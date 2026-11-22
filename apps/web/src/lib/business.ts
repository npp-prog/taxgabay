import "server-only";
import { join } from "node:path";
import { getBusinessChapter as get, listBusinessChapters as list } from "@taxgabay/content/business";

const DIR = join(process.cwd(), "..", "..", "packages", "content", "business");

export const listBusinessChapters = () => list(DIR);
export const getBusinessChapter = (slug: string) => get(slug, DIR);
