"use client";

import * as React from "react";
import { en, type Messages } from "./en";
import { fil } from "./fil";

export type Locale = "en" | "fil";
export const LOCALES: Locale[] = ["en", "fil"];
const DICTS: Record<Locale, Messages> = { en, fil };
const KEY = "taxgabay:locale";

// ---------- Locale store (localStorage, cross-tab) ----------

const listeners = new Set<() => void>();
let current: Locale | null = null;

function read(): Locale {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "fil" ? "fil" : "en";
  } catch {
    return "en";
  }
}

function getSnapshot(): Locale {
  current ??= read();
  return current;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = read();
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function setLocale(l: Locale) {
  current = l;
  try {
    window.localStorage.setItem(KEY, l);
  } catch {
    /* storage blocked: applies for this page view only */
  }
  document.documentElement.lang = l === "fil" ? "fil" : "en-PH";
  listeners.forEach((fn) => fn());
}

export { format } from "./format";

/** The current locale's messages. Server render and hydration use English. */
export function useLocale(): { locale: Locale; t: Messages } {
  const locale = React.useSyncExternalStore(subscribe, getSnapshot, () => "en" as Locale);
  React.useEffect(() => {
    document.documentElement.lang = locale === "fil" ? "fil" : "en-PH";
  }, [locale]);
  return { locale, t: DICTS[locale] };
}

export function messagesFor(l: Locale): Messages {
  return DICTS[l];
}
