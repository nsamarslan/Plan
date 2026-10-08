import { createClient, type RealtimeChannel, type SupabaseClient, type User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { allDocKeys, applyRemote, getDoc, getState, onLocalChange } from './store';

// Phone <-> web sync through one Supabase table:
//   documents(user_id, key, data jsonb, updated_ms bigint)
// Last write wins per document, using the editing device's clock.

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

let client: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
const dirty = new Set<string>();
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let lastPullMs = 0;

function config(): { url: string; key: string } | null {
  const s = getState().settings;
  const url = s.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
  const key = s.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function initSync(): void {
  const cfg = config();
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
  onLocalChange((key) => {
    dirty.add(key);
    schedulePush();
  });
  const resume = () => {
    if (document.visibilityState === 'visible' && status.user) void pullSince(lastPullMs - 60_000);
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

export async function signOut(): Promise<void> {
  await client?.auth.signOut();
}

function schedulePush() {
  if (!status.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushDirty(), 1200);
}

async function pushKeys(keys: string[]): Promise<void> {
  if (!client || !status.user || !keys.length) return;
  const rows = keys
    .map((key) => ({ key, env: getDoc(key) }))
    .filter((r) => r.env)
    .map((r) => ({ user_id: status.user!.id, key: r.key, data: r.env!.data, updated_ms: r.env!.updatedAt }));
  const { error } = await client.from('documents').upsert(rows, { onConflict: 'user_id,key' });
  if (error) throw error;
}

async function pushDirty(): Promise<void> {
  const keys = [...dirty];
  dirty.clear();
  try {
    setStatus({ state: 'syncing' });
    await pushKeys(keys);
    setStatus({ state: 'idle', lastSync: Date.now(), error: undefined });
  } catch (e) {
    keys.forEach((k) => dirty.add(k));
    setStatus({ state: 'error', error: errMsg(e) });
  }
}

function errMsg(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
}

interface Row {
  key: string;
  data: unknown;
  updated_ms: number;
}

async function pullSince(sinceMs: number): Promise<Row[]> {
  if (!client || !status.user) return [];
  const { data, error } = await client
    .from('documents')
    .select('key,data,updated_ms')
    .gt('updated_ms', Math.max(0, sinceMs));
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  for (const r of rows) {
    applyRemote(r.key, r.data, Number(r.updated_ms));
    lastPullMs = Math.max(lastPullMs, Number(r.updated_ms));
  }
  return rows;
}

export async function fullSync(): Promise<void> {
  if (!client || !status.user) return;
  try {
    setStatus({ state: 'syncing' });
    const rows = await pullSince(0);
    const remote = new Map(rows.map((r) => [r.key, Number(r.updated_ms)]));
    // Push what the server doesn't have or has older (but never untouched defaults).
    const push = allDocKeys().filter((k) => {
      const local = getDoc(k);
      return local && local.updatedAt > 0 && local.updatedAt > (remote.get(k) ?? 0);
    });
    await pushKeys(push);
    startRealtime();
    setStatus({ state: 'idle', lastSync: Date.now(), error: undefined });
  } catch (e) {
    setStatus({ state: 'error', error: errMsg(e) });
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
        if (r?.key) {
          applyRemote(r.key, r.data, Number(r.updated_ms));
          lastPullMs = Math.max(lastPullMs, Number(r.updated_ms));
        }
      },
    )
    .subscribe();
}

function stopRealtime() {
  if (channel && client) void client.removeChannel(channel);
  channel = null;
}
