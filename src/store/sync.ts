import { createClient, type RealtimeChannel, type SupabaseClient, type User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { allDocKeys, applyRemote, getDoc, getState, onLocalChange, resetAll } from './store';

// Phone <-> web sync through one Supabase table:
//   documents(user_id, key, data jsonb, updated_ms bigint, synced_at timestamptz)
// Last write wins per document, using the editing device's clock (updated_ms).
// The server refuses to replace a newer row with an older one, and stamps
// every write with its own clock (synced_at), which is what we page through
// when catching up — so rows uploaded late are never skipped.

export interface SyncStatus {
  configured: boolean;
  user: User | null;
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSync?: number;
  error?: string;
}

let status: SyncStatus = { configured: false, user: null, state: 'off' };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

/** Per-device connection settings. Never synced: they decide where syncing goes. */
const CONFIG_KEY = 'plan:supabase';
/** Account whose data is in local storage right now. */
const OWNER_KEY = 'plan:sync-owner';
/** Highest server `synced_at` already applied. */
const CURSOR_KEY = 'plan:sync-cursor';
const PAGE = 500;
const RETRY_MS = 30_000;

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export interface SupabaseConfig {
  url: string;
  key: string;
  fromBuild: boolean;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey, fromBuild: true };
  try {
    const saved = JSON.parse(ls.get(CONFIG_KEY) ?? 'null') as { url?: string; key?: string } | null;
    if (saved?.url && saved.key) return { url: saved.url, key: saved.key, fromBuild: false };
  } catch {
    /* fall through */
  }
  // Older versions kept these inside the synced settings document.
  const s = getState().settings;
  if (s.supabaseUrl && s.supabaseKey) {
    setSupabaseConfig(s.supabaseUrl, s.supabaseKey);
    return { url: s.supabaseUrl, key: s.supabaseKey, fromBuild: false };
  }
  return null;
}

export function setSupabaseConfig(url: string, key: string) {
  ls.set(CONFIG_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
}

export function clearSupabaseConfig() {
  ls.del(CONFIG_KEY);
}

let client: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
const dirty = new Set<string>();
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let cursor: string | null = ls.get(CURSOR_KEY);
let wired = false;

function setCursor(c: string | null) {
  cursor = c;
  if (c) ls.set(CURSOR_KEY, c);
  else ls.del(CURSOR_KEY);
}

export function initSync(): void {
  if (client) return;
  const cfg = getSupabaseConfig();
  if (!cfg) {
    setStatus({ configured: false, state: 'off' });
    return;
  }
  try {
    client = createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'plan-auth' },
    });
  } catch (e) {
    setStatus({ configured: false, state: 'error', error: String(e) });
    return;
  }
  setStatus({ configured: true });
  client.auth.onAuthStateChange((_ev, session) => {
    const user = session?.user ?? null;
    const changed = user?.id !== status.user?.id;
    setStatus({ user, state: user ? status.state : 'off' });
    if (user && changed) void fullSync();
    if (!user) stopRealtime();
  });
  if (wired) return;
  wired = true;
  onLocalChange((key) => {
    dirty.add(key);
    schedulePush();
  });
  const resume = () => {
    if (document.visibilityState !== 'visible' || !status.user) return;
    // Startup sync never finished (e.g. offline at launch): do it now.
    if (!channel) {
      void fullSync();
      return;
    }
    void pullNow().then(() => {
      if (dirty.size) void pushDirty();
    });
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!client) return 'Senkron ayarlanmamış.';
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!client) return 'Senkron ayarlanmamış.';
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) return error.message;
  if (!data.session) return 'Kayıt tamam. E-postandaki onay linkine tıkla, sonra giriş yap.';
  return null;
}

/** Sign out on this device only (the other device stays signed in). */
export async function signOut(): Promise<void> {
  clearTimeout(pushTimer);
  clearTimeout(retryTimer);
  dirty.clear();
  await client?.auth.signOut({ scope: 'local' });
}

/** "Bu cihazdaki her şeyi sıfırla": sign out here and start from defaults. */
export async function resetLocal(): Promise<void> {
  await signOut().catch(() => {});
  ls.del(OWNER_KEY);
  setCursor(null);
  resetAll();
}

function schedulePush() {
  if (!status.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushDirty(), 1200);
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    if (!status.user) return;
    if (!channel) void fullSync();
    else if (dirty.size) void pushDirty();
  }, RETRY_MS);
}

async function pushKeys(keys: string[]): Promise<void> {
  if (!client || !status.user || !keys.length) return;
  const rows = keys
    .map((key) => ({ key, env: getDoc(key) }))
    .filter((r) => r.env)
    .map((r) => ({ user_id: status.user!.id, key: r.key, data: r.env!.data, updated_ms: r.env!.updatedAt }));
  // The server keeps whichever copy is newer (see supabase/schema.sql).
  const { error } = await client.from('documents').upsert(rows, { onConflict: 'user_id,key' });
  if (error) throw error;
}

async function pushDirty(): Promise<void> {
  if (!status.user) return;
  const keys = [...dirty];
  dirty.clear();
  try {
    setStatus({ state: 'syncing' });
    // See newer copies from the other device before uploading ours.
    await pullChanges();
    await pushKeys(keys);
    setStatus({ state: 'idle', lastSync: Date.now(), error: undefined });
  } catch (e) {
    keys.forEach((k) => dirty.add(k));
    setStatus({ state: 'error', error: errMsg(e) });
    scheduleRetry();
  }
}

function errMsg(e: unknown): string {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/synced_at/.test(msg)) return `${msg} — supabase/schema.sql dosyasını SQL Editor'de yeniden çalıştır.`;
  return msg;
}

interface Row {
  key: string;
  data: unknown;
  updated_ms: number;
  synced_at: string;
}

function applyRow(r: Row) {
  applyRemote(r.key, r.data, Number(r.updated_ms));
  if (r.synced_at && (!cursor || r.synced_at > cursor)) setCursor(r.synced_at);
}

/** Fetch every row written since the cursor, page by page. */
async function pullChanges(): Promise<Row[]> {
  if (!client || !status.user) return [];
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = client.from('documents').select('key,data,updated_ms,synced_at').order('synced_at').order('key');
    // gte, not gt: rows sharing the cursor's timestamp are re-read; applying is idempotent.
    if (cursor) q = q.gte('synced_at', cursor);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  all.forEach(applyRow);
  return all;
}

/** Catch up with the server now (used before applying notification taps). */
export function pullNow(timeoutMs = 4000): Promise<void> {
  if (!client || !status.user) return Promise.resolve();
  return Promise.race([
    pullChanges().then(() => undefined),
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ]).catch(() => undefined);
}

export async function fullSync(): Promise<void> {
  if (!client || !status.user) return;
  const uid = status.user.id;
  try {
    // Local data that belongs to a different account must not be merged into this one.
    const owner = ls.get(OWNER_KEY);
    if (owner && owner !== uid) {
      clearTimeout(pushTimer);
      dirty.clear();
      setCursor(null);
      resetAll();
    }
    setStatus({ state: 'syncing' });
    setCursor(null);
    const rows = await pullChanges();
    const remote = new Map(rows.map((r) => [r.key, Number(r.updated_ms)]));
    // Push what the server doesn't have or has older (but never untouched defaults).
    const push = allDocKeys().filter((k) => {
      const local = getDoc(k);
      return local && local.updatedAt > 0 && local.updatedAt > (remote.get(k) ?? 0);
    });
    await pushKeys(push);
    ls.set(OWNER_KEY, uid);
    startRealtime();
    setStatus({ state: 'idle', lastSync: Date.now(), error: undefined });
    if (dirty.size) void pushDirty();
  } catch (e) {
    setStatus({ state: 'error', error: errMsg(e) });
    scheduleRetry();
  }
}

function startRealtime() {
  if (!client || !status.user || channel) return;
  channel = client
    .channel('documents')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${status.user.id}` },
      (payload) => {
        const r = payload.new as Row | undefined;
        if (r?.key) applyRow(r);
      },
    )
    .subscribe();
}

function stopRealtime() {
  if (channel && client) void client.removeChannel(channel);
  channel = null;
}
