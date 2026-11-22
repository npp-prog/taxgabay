"use client";

import { deadlineExtensions, holidays as bundledHolidays, type DeadlineExtension, type Holiday } from "@taxgabay/tax-engine";
import { mergeCalendarData } from "./calendar-merge";
import * as React from "react";
import { getSupabase } from "./supabase";

export function useCalendarData() {
  const [data, setData] = React.useState(() => ({ holidays: bundledHolidays, extensions: deadlineExtensions }));
  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    Promise.all([sb.from("holidays").select("date,name,type,year,legal_basis,needs_verification"), sb.from("deadline_extensions").select("form_code,original_date,new_date,issuance_ref")]).then(([h, e]) => {
      if (!cancelled && !h.error && !e.error) setData(mergeCalendarData((h.data ?? []) as Holiday[], (e.data ?? []) as DeadlineExtension[]));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
