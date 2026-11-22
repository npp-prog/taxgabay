"use client";

import type { EntryLine, Track } from "@taxgabay/accounting";
import * as React from "react";

/** A learner's work on one practice set, kept in this browser. */
export interface PracticeProgress {
  /** Transactions answered correctly. */
  correct: string[];
  /** Answers revealed with "Show answer" (still counted as done, marked as revealed). */
  revealed: string[];
  /** Last attempt per transaction, so work survives a reload. */
  attempts: Record<string, EntryLine[]>;
}

const EMPTY: PracticeProgress = { correct: [], revealed: [], attempts: {} };
const key = (slug: string) => `taxgabay:practice:${slug}`;
const TRACK_KEY = "taxgabay:practice-track";

const cache = new Map<string, PracticeProgress>();
const listeners = new Set<() => void>();

function read(slug: string): PracticeProgress {
  try {
    const raw = window.localStorage.getItem(key(slug));
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<PracticeProgress>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function snapshot(slug: string): PracticeProgress {
  if (!cache.has(slug)) cache.set(slug, read(slug));
  return cache.get(slug)!;
}

function write(slug: string, p: PracticeProgress) {
  cache.set(slug, p);
  try {
    window.localStorage.setItem(key(slug), JSON.stringify(p));
  } catch {
    /* storage blocked: keeps working for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePracticeProgress(slug: string) {
  const progress = React.useSyncExternalStore(subscribe, () => snapshot(slug), () => EMPTY);
  return {
    progress,
    saveAttempt: (id: string, lines: EntryLine[]) => write(slug, { ...snapshot(slug), attempts: { ...snapshot(slug).attempts, [id]: lines } }),
    markCorrect: (id: string) => {
      const p = snapshot(slug);
      if (!p.correct.includes(id)) write(slug, { ...p, correct: [...p.correct, id] });
    },
    reveal: (id: string) => {
      const p = snapshot(slug);
      if (!p.revealed.includes(id)) write(slug, { ...p, revealed: [...p.revealed, id] });
    },
    reset: () => write(slug, EMPTY),
  };
}

// ---------- Track (owner or student) ----------

let track: Track | null = null;
const trackListeners = new Set<() => void>();

function readTrack(): Track {
  try {
    return window.localStorage.getItem(TRACK_KEY) === "student" ? "student" : "owner";
  } catch {
    return "owner";
  }
}

export function useTrack(): [Track, (t: Track) => void] {
  const t = React.useSyncExternalStore(
    (l) => {
      trackListeners.add(l);
      return () => trackListeners.delete(l);
    },
    () => (track ??= readTrack()),
    () => "owner" as Track,
  );
  const set = (next: Track) => {
    track = next;
    try {
      window.localStorage.setItem(TRACK_KEY, next);
    } catch {
      /* ignore */
    }
    trackListeners.forEach((l) => l());
  };
  return [t, set];
}
