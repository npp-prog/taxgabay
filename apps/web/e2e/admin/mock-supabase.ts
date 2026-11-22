import type { Page, Route } from "@playwright/test";

/**
 * Minimal in-memory PostgREST + GoTrue stand-in for admin e2e tests. It understands the
 * query shapes the app uses (select, eq/neq, or, order, limit, insert, update, upsert,
 * delete) and mirrors the database's issuance workflow trigger.
 */

type Row = Record<string, unknown>;

export interface MockDb {
  tables: Record<string, Row[]>;
  requests: { method: string; table: string; body: unknown }[];
}

const ADMIN_USER = { id: "00000000-0000-0000-0000-00000000a001", aud: "authenticated", role: "authenticated", email: "admin@example.test", app_metadata: { role: "admin" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

export function sessionFor(appRole: "admin" | null) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600 * 24,
    expires_at: now + 3600 * 24,
    user: { ...ADMIN_USER, app_metadata: appRole ? { role: appRole } : {} },
  };
}

let seq = 1;
const uuid = () => `00000000-0000-0000-0000-${String(seq++).padStart(12, "0")}`;

export function issuance(over: Row): Row {
  return {
    id: uuid(),
    slug: "",
    type: "RR",
    number: "",
    title: "",
    date_issued: null,
    effectivity_date: null,
    tax_types: [],
    topics: [],
    summary_plain: null,
    status: "active",
    source_url: null,
    needs_verification: true,
    workflow_state: "draft",
    reviewed_at: null,
    reviewed_by: null,
    added_by: null,
    updated_at: "2026-11-01T00:00:00Z",
    ...over,
  };
}

const CONTENT_KEYS = ["slug", "type", "number", "title", "date_issued", "effectivity_date", "tax_types", "topics", "summary_plain", "status", "source_url"];

/** Same rules as public.issuance_workflow(). Returns an error message or null. */
function applyIssuanceUpdate(old: Row, patch: Row): string | null {
  const contentChanged = CONTENT_KEYS.some((k) => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(old[k]));
  const to = patch.workflow_state as string | undefined;
  if (to && to !== old.workflow_state) {
    if (contentChanged) return "Save content changes and workflow changes separately";
    const ok = (old.workflow_state === "draft" && to === "reviewed") || (old.workflow_state === "reviewed" && (to === "published" || to === "draft")) || (old.workflow_state === "published" && to === "draft");
    if (!ok) return `Cannot move an issuance from ${old.workflow_state} to ${to}`;
    if (to === "reviewed") {
      if (!String(old.summary_plain ?? "").trim() || !old.source_url || !(old.tax_types as string[]).length) return "A summary, the official source link and at least one tax type are required before review";
      patch.reviewed_at = new Date().toISOString();
      patch.reviewed_by = ADMIN_USER.id;
    } else if (to === "draft") {
      patch.reviewed_at = null;
      patch.reviewed_by = null;
    }
  } else if (contentChanged && old.workflow_state !== "draft") {
    patch.workflow_state = "draft";
    patch.reviewed_at = null;
    patch.reviewed_by = null;
  }
  Object.assign(old, patch, { updated_at: new Date().toISOString() });
  return null;
}

function parseFilters(params: URLSearchParams): ((r: Row) => boolean)[] {
  const out: ((r: Row) => boolean)[] = [];
  for (const [k, v] of params) {
    if (["select", "order", "limit", "on_conflict", "columns"].includes(k)) continue;
    if (k === "or") {
      const parts = v.replace(/^\(|\)$/g, "").split(",").map((p) => p.split("."));
      out.push((r) => parts.some(([col, op, ...val]) => (op === "eq" ? String(r[col!]) === val.join(".") : false)));
      continue;
    }
    const [op, ...rest] = v.split(".");
    const val = rest.join(".");
    if (op === "eq") out.push((r) => String(r[k]) === val);
    else if (op === "neq") out.push((r) => String(r[k]) !== val);
  }
  return out;
}

function project(rows: Row[], select: string | null): Row[] {
  if (!select || select === "*") return rows;
  const cols = select.split(",").map((c) => c.trim());
  return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
}

export async function installMockSupabase(page: Page, opts: { role?: "admin" | null; tables?: Record<string, Row[]> } = {}): Promise<MockDb> {
  const db: MockDb = {
    tables: { issuances: [], issuance_links: [], deadline_extensions: [], holidays: [], admin_audit_log: [], profiles: [], user_obligations: [], user_roadmap_progress: [], user_checklist_progress: [], reminder_settings: [], ...(opts.tables ?? {}) },
    requests: [],
  };
  const session = sessionFor(opts.role === undefined ? "admin" : opts.role);
  await page.addInitScript((s) => localStorage.setItem("sb-supabase-auth-token", JSON.stringify(s)), session);

  await page.route("http://supabase.test/auth/v1/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: session.user });
    if (url.pathname.endsWith("/token")) return route.fulfill({ json: session });
    return route.fulfill({ json: {} });
  });

  await page.route("http://supabase.test/rest/v1/**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split("/").pop()!;
    const rows = (db.tables[table] ??= []);
    const filters = parseFilters(url.searchParams);
    const match = (r: Row) => filters.every((f) => f(r));
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()!) : null;
    db.requests.push({ method, table, body });
    const wantsObject = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const respond = (data: Row[]) => {
      const projected = project(data, url.searchParams.get("select"));
      if (wantsObject) {
        if (projected.length !== 1) return route.fulfill({ status: 406, json: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } });
        return route.fulfill({ json: projected[0] });
      }
      return route.fulfill({ json: projected });
    };

    if (method === "GET") {
      let result = rows.filter(match);
      const order = url.searchParams.get("order");
      if (order) {
        const [col, dir] = order.split(".");
        result = [...result].sort((a, b) => String(a[col!]).localeCompare(String(b[col!])) * (dir === "desc" ? -1 : 1));
      }
      const limit = url.searchParams.get("limit");
      return respond(limit ? result.slice(0, Number(limit)) : result);
    }
    if (method === "POST") {
      const items = (Array.isArray(body) ? body : [body]) as Row[];
      const inserted: Row[] = [];
      for (const it of items) {
        if (table === "issuances") {
          if (it.workflow_state && it.workflow_state !== "draft") return route.fulfill({ status: 400, json: { message: "New issuances must start as drafts" } });
          const r = issuance({ ...it, workflow_state: "draft", added_by: ADMIN_USER.id });
          rows.push(r);
          inserted.push(r);
        } else {
          const r = { id: uuid(), ...it };
          rows.push(r);
          inserted.push(r);
        }
        db.tables.admin_audit_log!.unshift({ id: seq++, table_name: table, row_pk: String(inserted.at(-1)!.id), action: "INSERT", old_row: null, new_row: inserted.at(-1), actor: ADMIN_USER.id, at: new Date().toISOString() });
      }
      return respond(inserted);
    }
    if (method === "PATCH") {
      const targets = rows.filter(match);
      for (const t of targets) {
        const before = { ...t };
        if (table === "issuances") {
          const err = applyIssuanceUpdate(t, { ...(body as Row) });
          if (err) return route.fulfill({ status: 400, json: { message: err, code: "P0001" } });
        } else Object.assign(t, body);
        db.tables.admin_audit_log!.unshift({ id: seq++, table_name: table, row_pk: String(t.id), action: "UPDATE", old_row: before, new_row: { ...t }, actor: ADMIN_USER.id, at: new Date().toISOString() });
      }
      return respond(targets);
    }
    if (method === "DELETE") {
      const keep = rows.filter((r) => !match(r));
      const removed = rows.filter(match);
      db.tables[table] = keep;
      return respond(removed);
    }
    return route.fulfill({ status: 405, json: { message: "unsupported" } });
  });
  return db;
}
