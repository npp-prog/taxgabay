import { createClient } from "@supabase/supabase-js";
import { isAllowedSourceUrl } from "@taxgabay/content/ingest";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "text/html", "text/plain"];

async function isAdmin(request: Request): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return false;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return !error && (data.user?.app_metadata as { role?: string } | undefined)?.role === "admin";
}

/**
 * Admin-only proxy that fetches an issuance document from an allow-listed government
 * site, so the browser can extract its text. Redirects are followed only within the allow-list.
 */
export async function GET(request: Request) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  let target = new URL(request.url).searchParams.get("url") ?? "";
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedSourceUrl(target)) return NextResponse.json({ error: "Only https links on bir.gov.ph, dof.gov.ph or officialgazette.gov.ph are allowed" }, { status: 400 });
    let res: Response;
    try {
      res = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "TaxGabay issuance fetcher" } });
    } catch (e) {
      return NextResponse.json({ error: `Could not fetch: ${(e as Error).message}` }, { status: 502 });
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      target = new URL(res.headers.get("location")!, target).href;
      continue;
    }
    if (!res.ok) return NextResponse.json({ error: `Source returned ${res.status}` }, { status: 502 });
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!ALLOWED_TYPES.includes(type)) return NextResponse.json({ error: `Unsupported content type ${type || "unknown"}` }, { status: 415 });
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });
    return new NextResponse(body, { headers: { "Content-Type": type, "X-Source-Url": target, "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: "Too many redirects" }, { status: 502 });
}
