import { useSyncExternalStore } from 'react';
import { addDays, dateKey, DAY_MIN, daysBetween, weekday, type DateKey } from '../lib/time';
import { DEFAULT_TYPES, defaultAudio, defaultSettings, defaultTemplate } from '../model/defaults';
import { emptyDay } from '../model/schedule';
import type { AudioSettings, BlockType, BodyLog, DayDoc, ExercisePref, ItemLog, ItemOverride, Settings, SetLog, TemplateItem, WorkoutLog } from '../model/types';
import { toast } from '../services/toast';

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

let storageWarned = false;

function writeDoc(key: string, env: DocEnvelope): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(env));
  } catch {
    // Storage full or unavailable: the change lives in memory only until the
    // app closes. Say so once instead of pretending it was saved.
    if (!storageWarned) {
      storageWarned = true;
      toast({ title: 'Kaydedilemedi', body: 'Cihaz depolaması dolu ya da kapalı. Değişiklikler uygulama kapanınca kaybolabilir.', color: '#f87171' }, 12000);
    }
  }
}

// ---- Validation -----------------------------------------------------------
// Everything read from storage, the server or a backup file goes through
// these, so one malformed record can never stop the app from opening.

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : []);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['pending', 'active', 'done', 'skipped']);

function cleanItem(v: unknown): TemplateItem | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.typeId) || !isNum(v.start) || !isNum(v.duration)) return null;
  if (v.duration < 5 || v.start < 0) return null;
  return {
    id: v.id,
    typeId: v.typeId,
    label: isStr(v.label) && v.label ? v.label : undefined,
    start: Math.min(Math.round(v.start), DAY_MIN - 5),
    duration: Math.round(v.duration),
    days: Array.isArray(v.days) ? v.days.filter((d): d is number => isNum(d) && d >= 0 && d <= 6) : [],
    minimal: v.minimal === true ? true : undefined,
    minimalDuration: isNum(v.minimalDuration) && v.minimalDuration >= 5 ? Math.round(v.minimalDuration) : undefined,
    dnd: typeof v.dnd === 'boolean' ? v.dnd : undefined,
  };
}

const inRange = (v: unknown, min: number, max: number): v is number => isNum(v) && v >= min && v <= max;

function cleanWorkout(v: unknown): WorkoutLog | null {
  if (!isObj(v) || !isStr(v.name) || !Array.isArray(v.exercises)) return null;
  const exercises = v.exercises
    .filter((e): e is Record<string, unknown> => isObj(e) && isStr(e.name) && Array.isArray(e.sets))
    .map((e) => ({
      name: e.name as string,
      reps: isStr(e.reps) ? e.reps : '',
      restSec: inRange(e.restSec, 5, 3600) ? Math.round(e.restSec) : 90,
      sets: (e.sets as unknown[]).filter(isObj).map((x) => {
        const set: SetLog = {};
        if (inRange(x.kg, 0, 1000)) set.kg = x.kg;
        if (inRange(x.reps, 0, 1000)) set.reps = Math.round(x.reps);
        if (x.done === true) set.done = true;
        return set;
      }),
    }));
  return { name: v.name, exercises };
}

function cleanBody(v: unknown): BodyLog | null {
  if (!isObj(v)) return null;
  const b: BodyLog = {};
  if (inRange(v.kg, 20, 400)) b.kg = v.kg;
  if (inRange(v.protein, 0, 1000)) b.protein = Math.round(v.protein);
  if (inRange(v.water, 0, 20)) b.water = v.water;
  return Object.keys(b).length ? b : null;
}

function cleanTemplate(v: unknown): TemplateItem[] | null {
  return Array.isArray(v) ? v.map(cleanItem).filter((x): x is TemplateItem => !!x) : null;
}

export function cleanDay(date: DateKey, v: unknown): DayDoc | null {
  if (!isObj(v) || !DATE_RE.test(date)) return null;
  const overrides: Record<string, ItemOverride> = {};
  if (isObj(v.overrides)) {
    for (const [id, o] of Object.entries(v.overrides)) {
      if (!isObj(o)) continue;
      const ov: ItemOverride = {};
      if (isNum(o.start) && o.start >= 0) ov.start = Math.round(o.start);
      if (isNum(o.duration) && o.duration >= 5) ov.duration = Math.round(o.duration);
      if (o.removed === true) ov.removed = true;
      if (typeof o.dnd === 'boolean') ov.dnd = o.dnd;
      overrides[id] = ov;
    }
  }
  const logs: Record<string, ItemLog> = {};
  if (isObj(v.logs)) {
    for (const [id, l] of Object.entries(v.logs)) {
      if (!isObj(l) || !isStr(l.status) || !STATUSES.has(l.status)) continue;
      const log: ItemLog = { status: l.status as ItemLog['status'] };
      if (isNum(l.startedAt)) log.startedAt = l.startedAt;
      if (isNum(l.endedAt)) log.endedAt = l.endedAt;
      if (log.status === 'active' && isNum(l.pausedAt)) log.pausedAt = l.pausedAt;
      if (isNum(l.pausedMs) && l.pausedMs > 0) log.pausedMs = l.pausedMs;
      logs[id] = log;
    }
  }
  const tpl = v.tpl === undefined ? null : cleanTemplate(v.tpl);
  const workout = cleanWorkout(v.workout);
  const body = cleanBody(v.body);
  return {
    date,
    mode: v.mode === 'minimal' || v.mode === 'off' ? v.mode : 'normal',
    overrides,
    extras: cleanTemplate(v.extras) ?? [],
    logs,
    ...(tpl ? { tpl } : {}),
    ...(workout ? { workout } : {}),
    ...(body ? { body } : {}),
  };
}

/** New fields added in later versions get their defaults; broken fields are reset. */
function cleanSettings(v: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(v)) return d;
  const s = { ...d, ...v } as Settings;
  for (const k of ['wake', 'sleep', 'preWarnMin', 'remindEveryMin', 'remindCount', 'weeklySummaryAt'] as const) {
    if (!isNum(s[k])) s[k] = d[k];
  }
  s.weeklySummaryAt = Math.min(Math.max(0, Math.round(s.weeklySummaryAt)), DAY_MIN - 1);
  if (typeof s.weeklySummary !== 'boolean') s.weeklySummary = d.weeklySummary;
  s.wake = Math.min(Math.max(0, s.wake), DAY_MIN - 1);
  s.sleep = Math.min(Math.max(0, s.sleep), DAY_MIN - 1);
  s.dndRanges = Array.isArray(s.dndRanges)
    ? s.dndRanges.filter((r) => isObj(r) && isStr(r.id) && isNum(r.start) && isNum(r.end) && Array.isArray(r.days))
    : d.dndRanges;
  s.allowedApps = strings(s.allowedApps);
  if (!isStr(s.tiltStartDate) || !DATE_RE.test(s.tiltStartDate)) s.tiltStartDate = d.tiltStartDate;
  const prefs: Record<string, ExercisePref> = {};
  if (isObj(s.exercisePrefs)) {
    for (const [name, p] of Object.entries(s.exercisePrefs)) {
      if (!isObj(p)) continue;
      const pref: ExercisePref = {};
      if (inRange(p.restSec, 5, 3600)) pref.restSec = Math.round(p.restSec);
      if (inRange(p.sets, 1, 20)) pref.sets = Math.round(p.sets);
      if (Object.keys(pref).length) prefs[name] = pref;
    }
  }
  s.exercisePrefs = prefs;
  const da = defaultAudio();
  const a = { ...da, ...(isObj(v.audio) ? v.audio : {}) } as AudioSettings;
  for (const k of ['minSec', 'maxSec', 'musicVolume', 'voiceVolume', 'rate', 'pitch'] as const) {
    if (!isNum(a[k])) a[k] = da[k];
  }
  a.phrases = Array.isArray(a.phrases) ? a.phrases.filter((p) => isObj(p) && isStr(p.id) && isStr(p.text)) : da.phrases;
  a.clipIds = strings(a.clipIds);
  a.musicIds = strings(a.musicIds);
  if (!isStr(a.lang)) a.lang = da.lang;
  if (!isStr(a.voiceName)) a.voiceName = '';
  s.audio = a;
  return s;
}

const TYPE_BASE: Omit<BlockType, 'id' | 'name'> = {
  color: '#38bdf8',
  art: 'free',
  firstStep: '',
  mode: 'timer',
  tracked: true,
  dnd: false,
  notify: true,
  focusAudio: false,
  allowedApps: [],
  note: '',
};

function cleanTypes(v: unknown): BlockType[] | null {
  if (!Array.isArray(v)) return null;
  const byId = new Map(DEFAULT_TYPES.map((t) => [t.id, t]));
  const out = v
    .filter((t): t is Record<string, unknown> => isObj(t) && isStr(t.id) && isStr(t.name))
    .map((t) => {
      const merged = { ...TYPE_BASE, ...(byId.get(t.id as string) ?? {}), ...t } as BlockType;
      merged.allowedApps = strings(merged.allowedApps);
      if (!(isNum(merged.focusMin) && merged.focusMin >= 5 && merged.focusMin <= 240)) delete merged.focusMin;
      if (!(isNum(merged.breakMin) && merged.breakMin >= 0 && merged.breakMin <= 120)) delete merged.breakMin;
      if (!isStr(merged.note)) merged.note = '';
      if (!isStr(merged.firstStep)) merged.firstStep = '';
      return merged;
    });
  return out.length ? out : null;
}

const stampOf = (env: DocEnvelope | null) => (env && isNum(env.updatedAt) ? env.updatedAt : 0);

function load(): AppState {
  const stamps: Record<string, number> = {};
  const s = readDoc<Settings>('settings');
  const t = readDoc<BlockType[]>('types');
  const tp = readDoc<TemplateItem[]>('template');
  stamps.settings = stampOf(s);
  stamps.types = stampOf(t);
  stamps.template = stampOf(tp);
  const types = cleanTypes(t?.data) ?? DEFAULT_TYPES;
  const days: Record<DateKey, DayDoc> = {};
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX + 'day:')) keys.push(k.slice(PREFIX.length));
  }
  for (const key of keys) {
    const env = readDoc<DayDoc>(key);
    const day = env && cleanDay(key.slice(4), env.data);
    if (day) {
      days[key.slice(4)] = day;
      stamps[key] = stampOf(env);
    }
  }
  const settings = cleanSettings(s?.data);
  // Defaults that change daily (the pelvis program's start date is "today")
  // must be stored the first time, or tomorrow they would be "today" again.
  // Stamp 0 keeps them "untouched", so sync never pushes them over real settings.
  if (!isObj(s?.data) || !isStr((s!.data as Partial<Settings>).tiltStartDate)) {
    writeDoc('settings', { data: settings, updatedAt: stamps.settings });
  }
  return {
    settings,
    types: Object.fromEntries(types.map((x) => [x.id, x])),
    typeOrder: types.map((x) => x.id),
    template: cleanTemplate(tp?.data) ?? defaultTemplate(),
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

/** Apply a document from the server or a backup. Returns true if it was newer and valid. */
export function applyRemote(key: string, data: unknown, updatedAt: number): boolean {
  if (!isNum(updatedAt) || (state.stamps[key] ?? 0) >= updatedAt) return false;
  let next: AppState;
  if (key === 'settings') {
    if (!isObj(data)) return false;
    next = { ...state, settings: cleanSettings(data) };
  } else if (key === 'types') {
    const list = cleanTypes(data);
    if (!list) return false;
    next = { ...state, types: Object.fromEntries(list.map((x) => [x.id, x])), typeOrder: list.map((x) => x.id) };
  } else if (key === 'template') {
    const list = cleanTemplate(data);
    if (!list) return false;
    next = { ...state, template: list };
  } else if (key.startsWith('day:')) {
    const day = cleanDay(key.slice(4), data);
    if (!day) return false;
    next = { ...state, days: { ...state.days, [key.slice(4)]: day } };
  } else return false;
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

/** How far back past days get their plan frozen (covers the 56-day program and 30-day stats). */
const FREEZE_WINDOW_DAYS = 120;

/**
 * Before the weekly template changes, give every past day that still follows
 * it a frozen copy, so stats and history keep the plan that day really had.
 */
function freezePastDays(oldTemplate: TemplateItem[]) {
  const today = dateKey(new Date());
  let date = firstDay();
  const earliest = addDays(today, -FREEZE_WINDOW_DAYS);
  if (daysBetween(earliest, date) < 0) date = earliest;
  for (; daysBetween(date, today) > 0; date = addDays(date, 1)) {
    const day = state.days[date];
    if (day?.tpl) continue;
    const wd = weekday(date);
    const tpl = oldTemplate.filter((t) => t.days.includes(wd));
    commit(`day:${date}`, { ...state, days: { ...state.days, [date]: { ...(day ?? emptyDay(date)), tpl } } }, Date.now(), true);
  }
}

export function updateTemplate(fn: (t: TemplateItem[]) => TemplateItem[]) {
  const next = fn(state.template).slice().sort((a, b) => a.start - b.start);
  freezePastDays(state.template);
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
