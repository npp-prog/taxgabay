"use client";

import { supabaseEnabled } from "./supabase";
import { useUserData } from "./user-data";

export type AdminStatus = "loading" | "disabled" | "signed_out" | "not_admin" | "admin";

/**
 * UI gate only. The database enforces admin rights with RLS (`is_admin()` reads the
 * same `app_metadata.role` claim), so hiding pages is never the security boundary.
 */
export function useAdminStatus(): AdminStatus {
  const { ready, session } = useUserData();
  if (!supabaseEnabled) return "disabled";
  if (!ready) return "loading";
  if (!session) return "signed_out";
  return (session.user.app_metadata as { role?: string } | undefined)?.role === "admin" ? "admin" : "not_admin";
}

/** sessionStorage key handing an ingestion draft to the issuance editor. */
export const INGEST_DRAFT_KEY = "taxgabay:ingest-draft";
