import { useSyncExternalStore } from 'react';
import { dateKey, type DateKey } from '../lib/time';
import { DEFAULT_TYPES, defaultAudio, defaultSettings, defaultTemplate } from '../model/defaults';
import { emptyDay } from '../model/schedule';
import type { BlockType, DayDoc, Settings, TemplateItem } from '../model/types';

// Everything the user owns is a small set of JSON "documents":
//   settings, types, template, day:YYYY-MM-DD
// Each carries updatedAt so two devices can sync with last-write-wins.

export interface DocEnvelope<T = unknown> {
  data: T;
  updatedAt: number;
}

export interface AppState {
  settings: Settings;
  types: Record<string, BlockType>;
  typeOrder: string[];
  template: TemplateItem[];
  days: Record<DateKey, DayDoc>;
  stamps: Record<string, number>;
}

const PREFIX = 'plan:doc:';
type Listener = () => void;
const listeners = new Set<Listener>();
const changeListeners = new Set<(key: string) => void>();

function readDoc<T>(key: string): DocEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as DocEnvelope<T>) : null;
  } catch {
    return null;
  }
}

function writeDoc(key: string, env: DocEnvelope): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(env));
  } catch {
    /* storage full or unavailable: keep in memory */
  }
}

/** New fields added in later versions get their defaults. */
function migrateSettings(s: Partial<Settings> | undefined): Settings {
  const d = defaultSettings();
  if (!s) return d;
  return { ...d, ...s, audio: { ...defaultAudio(), ...(s.audio ?? {}) } };
}

function migrateTypes(list: BlockType[] | undefined): BlockType[] {
  if (!list) return DEFAULT_TYPES;
  const byId = new Map(DEFAULT_TYPES.map((t) => [t.id, t]));
  return list.map((t) => ({ ...(byId.get(t.id) ?? {}), ...t }) as BlockType);
}

function load(): AppState {
  const stamps: Record<string, number> = {};
  const s = readDoc<Settings>('settings');
  const t = readDoc<BlockType[]>('types');
  const tp = readDoc<TemplateItem[]>('template');
  stamps.settings = s?.updatedAt ?? 0;
  stamps.types = t?.updatedAt ?? 0;
  stamps.template = tp?.updatedAt ?? 0;
  const types = migrateTypes(t?.data);
  const days: Record<DateKey, DayDoc> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(PREFIX + 'day:')) continue;
    const key = k.slice(PREFIX.length);
    const env = readDoc<DayDoc>(key);
    if (env) {
      days[key.slice(4)] = env.data;
      stamps[key] = env.updatedAt;
    }
  }
  return {
    settings: migrateSettings(s?.data),
    types: Object.fromEntries(types.map((x) => [x.id, x])),
    typeOrder: types.map((x) => x.id),
    template: tp?.data ?? defaultTemplate(),
    days,
    stamps,
  };
}

let state: AppState = load();

function emit(changedKey?: string) {
  listeners.forEach((l) => l());
  if (changedKey) changeListeners.forEach((l) => l(changedKey));
}

export function getState(): AppState {
  return state;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Fires with the document key after a *local* edit (used by sync + scheduler). */
export function onLocalChange(l: (key: string) => void): () => void {
  changeListeners.add(l);
  return () => changeListeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

function docData(key: string, s: AppState = state): unknown {
  if (key === 'settings') return s.settings;
  if (key === 'types') return s.typeOrder.map((id) => s.types[id]);
  if (key === 'template') return s.template;
  if (key.startsWith('day:')) return s.days[key.slice(4)];
  return undefined;
}

export function getDoc(key: string): DocEnvelope | null {
  const data = docData(key);
  return data === undefined ? null : { data, updatedAt: state.stamps[key] ?? 0 };
}

export function allDocKeys(): string[] {
  return ['settings', 'types', 'template', ...Object.keys(state.days).map((d) => `day:${d}`)];
}

function commit(key: string, next: AppState, updatedAt: number, local: boolean) {
  state = { ...next, stamps: { ...next.stamps, [key]: updatedAt } };
  writeDoc(key, { data: docData(key, state), updatedAt });
  emit(local ? key : undefined);
}

/** Apply a document that came from the server. Returns true if it was newer. */
export function applyRemote(key: string, data: unknown, updatedAt: number): boolean {
  if ((state.stamps[key] ?? 0) >= updatedAt) return false;
  let next: AppState = state;
  if (key === 'settings') next = { ...state, settings: migrateSettings(data as Settings) };
  else if (key === 'types') {
    const list = migrateTypes(data as BlockType[]);
    next = { ...state, types: Object.fromEntries(list.map((x) => [x.id, x])), typeOrder: list.map((x) => x.id) };
  } else if (key === 'template') next = { ...state, template: data as TemplateItem[] };
  else if (key.startsWith('day:')) next = { ...state, days: { ...state.days, [key.slice(4)]: data as DayDoc } };
  else return false;
  commit(key, next, updatedAt, false);
  return true;
}

export function updateSettings(fn: (s: Settings) => Settings) {
  commit('settings', { ...state, settings: fn(state.settings) }, Date.now(), true);
}

export function updateType(id: string, fn: (t: BlockType) => BlockType) {
  const t = state.types[id];
  if (!t) return;
  commit('types', { ...state, types: { ...state.types, [id]: fn(t) } }, Date.now(), true);
}

export function addType(t: BlockType) {
  commit('types', { ...state, types: { ...state.types, [t.id]: t }, typeOrder: [...state.typeOrder, t.id] }, Date.now(), true);
}

export function updateTemplate(fn: (t: TemplateItem[]) => TemplateItem[]) {
  const next = fn(state.template).slice().sort((a, b) => a.start - b.start);
  commit('template', { ...state, template: next }, Date.now(), true);
}

export function getDay(date: DateKey): DayDoc {
  return state.days[date] ?? emptyDay(date);
}

export function updateDay(date: DateKey, fn: (d: DayDoc) => DayDoc) {
  const next = fn(getDay(date));
  commit(`day:${date}`, { ...state, days: { ...state.days, [date]: next } }, Date.now(), true);
}

export function resetAll() {
  for (const key of allDocKeys()) localStorage.removeItem(PREFIX + key);
  state = load();
  emit();
}

/** First day with any record — stats don't count days before the app existed. */
export function firstDay(): DateKey {
  const keys = Object.keys(state.days).sort();
  return keys[0] ?? dateKey(new Date());
}
