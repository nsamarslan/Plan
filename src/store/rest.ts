import { useSyncExternalStore } from 'react';
import { clampRest, REST_MAX_SEC, type RestTimer } from '../model/workout';

// The rest between sets lives on this device only, like the standalone
// pomodoro: it's a few minutes long and only this phone has to ring.

const KEY = 'plan:rest';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(): RestTimer | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as RestTimer | null;
    if (!r || typeof r.endsAt !== 'number' || typeof r.totalSec !== 'number') return null;
    // Long over (the app was closed): forget it.
    if (Date.now() > r.endsAt + 60_000) return null;
    return { endsAt: r.endsAt, totalSec: r.totalSec, label: typeof r.label === 'string' ? r.label : '' };
  } catch {
    return null;
  }
}

let rest: RestTimer | null = load();

function save(next: RestTimer | null) {
  rest = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* in memory only */
  }
  emit();
}

export const getRest = () => rest;

export function subscribeRest(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const useRest = () => useSyncExternalStore(subscribeRest, getRest);

export function startRest(sec: number, label: string, nowMs = Date.now()) {
  const totalSec = clampRest(sec);
  save({ endsAt: nowMs + totalSec * 1000, totalSec, label });
}

/** ±15 s on the running rest; never below "now". */
export function nudgeRest(deltaSec: number, nowMs = Date.now()) {
  if (!rest) return;
  const endsAt = Math.max(nowMs, Math.min(rest.endsAt + deltaSec * 1000, nowMs + REST_MAX_SEC * 1000));
  save({ ...rest, endsAt, totalSec: Math.max(1, rest.totalSec + deltaSec) });
}

export const stopRest = () => save(null);
