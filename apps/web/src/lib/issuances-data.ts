"use client";

import { seedIssuanceLinks, seedIssuances, type Issuance, type IssuanceLink, type WorkflowState } from "@taxgabay/content/issuances";
import * as React from "react";
import { getSupabase, supabaseEnabled } from "./supabase";

/** Database row (adds id and workflow fields). */
export interface IssuanceRow extends Issuance {
  id: string;
  workflow_state: WorkflowState;
  reviewed_at: string | null;
  reviewed_by: string | null;
  added_by: string | null;
  updated_at: string;
}

export interface IssuanceLinkRow {
  from_id: string;
  to_id: string;
  relation: IssuanceLink["relation"];
}

export const ISSUANCE_COLUMNS =
  "id,slug,type,number,title,date_issued,effectivity_date,tax_types,topics,summary_plain,status,source_url,needs_verification,workflow_state,reviewed_at,reviewed_by,added_by,updated_at";

export function linksToSlugs(rows: IssuanceLinkRow[], list: { id: string; slug: string }[]): IssuanceLink[] {
  const slug = new Map(list.map((i) => [i.id, i.slug]));
  return rows
    .filter((l) => slug.has(l.from_id) && slug.has(l.to_id))
    .map((l) => ({ from_slug: slug.get(l.from_id)!, to_slug: slug.get(l.to_id)!, relation: l.relation }));
}

export interface LibraryData {
  issuances: Issuance[];
  links: IssuanceLink[];
  source: "database" | "bundled";
  loading: boolean;
  error: string | null;
}

/**
 * Published issuances: from Supabase when configured (RLS returns published rows only),
 * otherwise the bundled seed list.
 */
export function useLibrary(): LibraryData {
  const [state, setState] = React.useState<LibraryData>(() =>
    supabaseEnabled
      ? { issuances: [], links: [], source: "database", loading: true, error: null }
      : { issuances: seedIssuances, links: seedIssuanceLinks, source: "bundled", loading: false, error: null },
  );
  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    Promise.all([
      sb.from("issuances").select(ISSUANCE_COLUMNS).eq("workflow_state", "published"),
      sb.from("issuance_links").select("from_id,to_id,relation"),
    ]).then(([iss, links]) => {
      if (cancelled) return;
      if (iss.error) {
        setState({ issuances: [], links: [], source: "database", loading: false, error: iss.error.message });
        return;
      }
      const rows = (iss.data ?? []) as unknown as IssuanceRow[];
      setState({ issuances: rows, links: linksToSlugs((links.data ?? []) as IssuanceLinkRow[], rows), source: "database", loading: false, error: null });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
