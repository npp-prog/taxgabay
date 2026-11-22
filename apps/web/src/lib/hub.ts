import "server-only";
import { join } from "node:path";
import { getHubArticle as get, listHubArticles as list } from "@taxgabay/content/hub";

// Hub articles are read at build time (static generation), relative to the web app directory.
const DIR = join(process.cwd(), "..", "..", "packages", "content", "hub");

export const listHubArticles = () => list(DIR);
export const getHubArticle = (slug: string) => get(slug, DIR);
