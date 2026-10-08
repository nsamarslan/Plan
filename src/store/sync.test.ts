import { beforeEach, describe, expect, it, vi } from 'vitest';

// Store + sync tests against an in-memory fake of Supabase that behaves like
// supabase/schema.sql (RLS per user, "keep newer" trigger, synced_at clock).

type Row = { user_id: string; key: string; data: unknown; updated_ms: number; synced_at: string };

const server = {
  rows: [] as Row[],
  clock: 0,
  failUpserts: 0,
  signOutScopes: [] as string[],
  user: null as { id: string; email: string } | null,
  authCb: null as ((ev: string, session: { user: { id: string; email: string } } | null) => void) | null,
  stamp() {
    this.clock += 1;
    return new Date(Date.UTC(2026, 0, 1) + this.clock).toISOString();
  },
};

function query(rows: () => Row[]) {
  let list = rows();
  const q = {
    select: () => q,
    order: () => q,
    gte: (_col: string, v: string) => {
      list = list.filter((r) => r.synced_at >= v);
      return q;
    },
    range: async (from: number, to: number) => {
      const sorted = [...list].sort((a, b) => a.synced_at.localeCompare(b.synced_at) || a.key.localeCompare(b.key));
      return { data: sorted.slice(from, to + 1).map(({ user_id: _u, ...r }) => r), error: null };
    },
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (cb: typeof server.authCb) => {
        server.authCb = cb;
        queueMicrotask(() => cb?.('INITIAL_SESSION', server.user ? { user: server.user } : null));
      },
      signInWithPassword: async ({ email }: { email: string }) => {
        server.user = { id: `uid-${email}`, email };
        server.authCb?.('SIGNED_IN', { user: server.user });
        return { error: null };
      },
      signOut: async (opts?: { scope?: string }) => {
        server.signOutScopes.push(opts?.scope ?? 'global');
        server.user = null;
        server.authCb?.('SIGNED_OUT', null);
        return { error: null };
      },
    },
    from: () => ({
      ...query(() => server.rows.filter((r) => r.user_id === server.user?.id)),
      upsert: async (rows: Omit<Row, 'synced_at'>[]) => {
        if (server.failUpserts > 0) {
          server.failUpserts--;
          return { error: { message: 'offline' } };
        }
        for (const r of rows) {
          if (r.user_id !== server.user?.id) return { error: { message: 'RLS' } };
          const i = server.rows.findIndex((x) => x.user_id === r.user_id && x.key === r.key);
          if (i >= 0 && r.updated_ms < server.rows[i].updated_ms) continue; // trigger: keep newer
          const row = { ...r, synced_at: server.stamp() };
          if (i >= 0) server.rows[i] = row;
          else server.rows.push(row);
        }
        return { error: null };
      },
    }),
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: async () => {},
  }),
}));

const listeners: Record<string, (() => void)[]> = {};
function installGlobals() {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  };
  const on = (type: string, fn: () => void) => (listeners[type] ??= []).push(fn);
  (globalThis as Record<string, unknown>).document = { visibilityState: 'visible', addEventListener: on };
  (globalThis as Record<string, unknown>).window = { addEventListener: on };
  return mem;
}

const flush = async (ms = 2000) => {
  await vi.advanceTimersByTimeAsync(ms);
};

async function boot() {
  vi.resetModules();
  const store = await import('./store');
  const sync = await import('./sync');
  return { store, sync };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-08T09:00:00'));
  server.rows = [];
  server.user = null;
  server.failUpserts = 0;
  server.signOutScopes = [];
  for (const k of Object.keys(listeners)) delete listeners[k];
  installGlobals();
});

describe('store', () => {
  it('B4: a malformed stored day does not break loading', async () => {
    localStorage.setItem('plan:doc:day:2026-10-08', JSON.stringify({ data: { logs: null, overrides: 5, extras: 'x' }, updatedAt: 1 }));
    const { store } = await boot();
    const day = store.getDay('2026-10-08');
    expect(day.logs).toEqual({});
    expect(day.extras).toEqual([]);
    expect(store.applyRemote('template', 'garbage', Date.now())).toBe(false);
    expect(store.applyRemote('day:2026-10-07', { logs: null }, Date.now())).toBe(true);
    expect(store.getDay('2026-10-07').logs).toEqual({});
  });

  it('B6: the pelvis start date stays put on later days', async () => {
    const first = (await boot()).store.getState().settings.tiltStartDate;
    vi.setSystemTime(new Date('2026-10-10T09:00:00'));
    const again = (await boot()).store.getState();
    expect(again.settings.tiltStartDate).toBe(first);
    expect(again.stamps.settings).toBe(0); // still "untouched defaults" for sync
  });

  it('B3: editing the template freezes past days', async () => {
    const { store } = await boot();
    store.updateDay('2026-10-05', (d) => d); // first day of use
    store.updateTemplate((t) => t.filter((x) => x.typeId !== 'reading'));
    const past = store.getDay('2026-10-06');
    expect(past.tpl?.some((t) => t.typeId === 'reading')).toBe(true);
    expect(store.getDay('2026-10-08').tpl).toBeUndefined(); // today follows the new template
  });
});

describe('sync', () => {
  async function signedIn(email: string) {
    const ctx = await boot();
    ctx.sync.setSupabaseConfig('https://x.supabase.co', 'anon');
    ctx.sync.initSync();
    await flush(10);
    await ctx.sync.signIn(email, 'pw');
    await flush();
    return ctx;
  }

  it('new0: connection settings are per-device, not in the synced settings doc', async () => {
    const { store, sync } = await boot();
    sync.setSupabaseConfig('https://x.supabase.co', 'anon');
    expect(store.getState().stamps.settings).toBe(0);
    expect(sync.getSupabaseConfig()?.url).toBe('https://x.supabase.co');
  });

  it('new4: signing out only signs out this device', async () => {
    const { sync } = await signedIn('a@x');
    await sync.signOut();
    expect(server.signOutScopes).toEqual(['local']);
  });

  it("B1: another account's local data is not uploaded or mixed", async () => {
    const a = await signedIn('a@x');
    a.store.updateDay('2026-10-08', (d) => ({ ...d, mode: 'minimal' }));
    await flush();
    expect(server.rows.some((r) => r.user_id === 'uid-a@x' && r.key === 'day:2026-10-08')).toBe(true);
    await a.sync.signOut();
    await a.sync.signIn('b@x', 'pw');
    await flush();
    expect(server.rows.filter((r) => r.user_id === 'uid-b@x').map((r) => r.key)).toEqual([]);
    expect(a.store.getState().days['2026-10-08']).toBeUndefined();
  });

  it('B2: an older copy never replaces a newer one, and the newer one comes back', async () => {
    const { store } = await signedIn('a@x');
    // The other device wrote a newer template.
    server.rows.push({ user_id: 'uid-a@x', key: 'template', data: [], updated_ms: Date.now() + 60_000, synced_at: server.stamp() });
    store.updateDay('2026-10-08', (d) => ({ ...d, mode: 'minimal' }));
    await flush();
    expect(store.getState().template).toEqual([]); // pulled before pushing
    expect(server.rows.find((r) => r.key === 'template')!.data).toEqual([]);
  });

  it('B7: a failed upload is retried', async () => {
    const { store } = await signedIn('a@x');
    server.failUpserts = 1;
    store.updateDay('2026-10-08', (d) => ({ ...d, mode: 'minimal' }));
    await flush();
    expect(server.rows.some((r) => r.key === 'day:2026-10-08')).toBe(false);
    await flush(31_000);
    expect(server.rows.some((r) => r.key === 'day:2026-10-08')).toBe(true);
  });

  it('new6: rows uploaded late with an old edit time are still pulled', async () => {
    const { store, sync } = await signedIn('a@x');
    await flush();
    server.rows.push({
      user_id: 'uid-a@x',
      key: 'day:2026-10-01',
      data: { mode: 'minimal' },
      updated_ms: Date.parse('2026-10-01T10:00:00'),
      synced_at: server.stamp(),
    });
    await sync.pullNow();
    expect(store.getDay('2026-10-01').mode).toBe('minimal');
  });
});
