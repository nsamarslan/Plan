import { useSyncExternalStore } from 'react';
import { DEFAULT_QUICK, quickEndsAt, type QuickConfig, type QuickSession } from '../model/quick';

// The running standalone pomodoro lives on this device only (it isn't part of
// the plan, so it isn't synced). The last settings are remembered so the next
// one starts with a single tap.

const SESSION_KEY = 'plan:quick-session';
const CONFIG_KEY = 'plan:quick-config';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* in memory only */
  }
}

const isNum = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function cleanConfig(v: Partial<QuickConfig> | null): QuickConfig {
  const c = { ...DEFAULT_QUICK };
  if (!v || typeof v !== 'object') return c;
  if (isNum(v.focus, 5, 240)) c.focus = Math.round(v.focus!);
  if (isNum(v.brk, 0, 120)) c.brk = Math.round(v.brk!);
  if (isNum(v.rounds, 1, 12)) c.rounds = Math.round(v.rounds!);
  if (typeof v.label === 'string') c.label = v.label.slice(0, 80);
  if (typeof v.lock === 'boolean') c.lock = v.lock;
  return c;
}

function loadSession(): QuickSession | null {
  const s = read<QuickSession>(SESSION_KEY);
  if (!s || typeof s.id !== 'string' || !isNum(s.startedAt, 0, Number.MAX_SAFE_INTEGER)) return null;
  const session = { ...cleanConfig(s), id: s.id, startedAt: s.startedAt };
  // Long over (e.g. the app was closed): forget it.
  if (Date.now() > quickEndsAt(session) + 60_000) {
    write(SESSION_KEY, null);
    return null;
  }
  return session;
}

let session: QuickSession | null = loadSession();
let config: QuickConfig = cleanConfig(read<QuickConfig>(CONFIG_KEY));

export function getQuickSession(): QuickSession | null {
  return session;
}

export function getQuickConfig(): QuickConfig {
  return config;
}

export function subscribeQuick(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useQuickSession(): QuickSession | null {
  return useSyncExternalStore(subscribeQuick, getQuickSession);
}

export function startQuick(c: QuickConfig, nowMs = Date.now()) {
  config = cleanConfig(c);
  write(CONFIG_KEY, config);
  session = { ...config, id: `q${nowMs.toString(36)}`, startedAt: nowMs };
  write(SESSION_KEY, session);
  emit();
}

export function stopQuick() {
  session = null;
  write(SESSION_KEY, null);
  emit();
}

/** Clears a session whose time is up. Returns true if it just ended. */
export function expireQuick(nowMs = Date.now()): boolean {
  if (session && nowMs >= quickEndsAt(session)) {
    stopQuick();
    return true;
  }
  return false;
}
