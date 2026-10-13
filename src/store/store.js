import { useSyncExternalStore } from 'react';
import { addDays, dateKey, DAY_MIN, daysBetween, weekday } from '../lib/time';
import { DEFAULT_TYPES, defaultAudio, defaultSettings, defaultTemplate } from '../model/defaults';
import { emptyDay } from '../model/schedule';
import { toast } from '../services/toast';
const PREFIX = 'plan:doc:';
const listeners = new Set();
const changeListeners = new Set();
function readDoc(key) {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
let storageWarned = false;
function writeDoc(key, env) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(env));
    }
    catch {
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
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string';
const strings = (v) => (Array.isArray(v) ? v.filter(isStr) : []);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['pending', 'active', 'done', 'skipped']);
function cleanItem(v) {
    if (!isObj(v) || !isStr(v.id) || !isStr(v.typeId) || !isNum(v.start) || !isNum(v.duration))
        return null;
    if (v.duration < 5 || v.start < 0)
        return null;
    return {
        id: v.id,
        typeId: v.typeId,
        label: isStr(v.label) && v.label ? v.label : undefined,
        start: Math.min(Math.round(v.start), DAY_MIN - 5),
        duration: Math.round(v.duration),
        days: Array.isArray(v.days) ? v.days.filter((d) => isNum(d) && d >= 0 && d <= 6) : [],
        minimal: v.minimal === true ? true : undefined,
        minimalDuration: isNum(v.minimalDuration) && v.minimalDuration >= 5 ? Math.round(v.minimalDuration) : undefined,
        dnd: typeof v.dnd === 'boolean' ? v.dnd : undefined,
    };
}
function cleanTemplate(v) {
    return Array.isArray(v) ? v.map(cleanItem).filter((x) => !!x) : null;
}
export function cleanDay(date, v) {
    if (!isObj(v) || !DATE_RE.test(date))
        return null;
    const overrides = {};
    if (isObj(v.overrides)) {
        for (const [id, o] of Object.entries(v.overrides)) {
            if (!isObj(o))
                continue;
            const ov = {};
            if (isNum(o.start) && o.start >= 0)
                ov.start = Math.round(o.start);
            if (isNum(o.duration) && o.duration >= 5)
                ov.duration = Math.round(o.duration);
            if (o.removed === true)
                ov.removed = true;
            if (typeof o.dnd === 'boolean')
                ov.dnd = o.dnd;
            overrides[id] = ov;
        }
    }
    const logs = {};
    if (isObj(v.logs)) {
        for (const [id, l] of Object.entries(v.logs)) {
            if (!isObj(l) || !isStr(l.status) || !STATUSES.has(l.status))
                continue;
            const log = { status: l.status };
            if (isNum(l.startedAt))
                log.startedAt = l.startedAt;
            if (isNum(l.endedAt))
                log.endedAt = l.endedAt;
            logs[id] = log;
        }
    }
    const tpl = v.tpl === undefined ? null : cleanTemplate(v.tpl);
    return {
        date,
        mode: v.mode === 'minimal' ? 'minimal' : 'normal',
        overrides,
        extras: cleanTemplate(v.extras) ?? [],
        logs,
        ...(tpl ? { tpl } : {}),
    };
}
/** New fields added in later versions get their defaults; broken fields are reset. */
function cleanSettings(v) {
    const d = defaultSettings();
    if (!isObj(v))
        return d;
    const s = { ...d, ...v };
    for (const k of ['wake', 'sleep', 'preWarnMin', 'remindEveryMin', 'remindCount']) {
        if (!isNum(s[k]))
            s[k] = d[k];
    }
    s.wake = Math.min(Math.max(0, s.wake), DAY_MIN - 1);
    s.sleep = Math.min(Math.max(0, s.sleep), DAY_MIN - 1);
    s.dndRanges = Array.isArray(s.dndRanges)
        ? s.dndRanges.filter((r) => isObj(r) && isStr(r.id) && isNum(r.start) && isNum(r.end) && Array.isArray(r.days))
        : d.dndRanges;
    s.allowedApps = strings(s.allowedApps);
    if (!isStr(s.tiltStartDate) || !DATE_RE.test(s.tiltStartDate))
        s.tiltStartDate = d.tiltStartDate;
    const da = defaultAudio();
    const a = { ...da, ...(isObj(v.audio) ? v.audio : {}) };
    for (const k of ['minSec', 'maxSec', 'musicVolume', 'voiceVolume', 'rate', 'pitch']) {
        if (!isNum(a[k]))
            a[k] = da[k];
    }
    a.phrases = Array.isArray(a.phrases) ? a.phrases.filter((p) => isObj(p) && isStr(p.id) && isStr(p.text)) : da.phrases;
    a.clipIds = strings(a.clipIds);
    a.musicIds = strings(a.musicIds);
    if (!isStr(a.lang))
        a.lang = da.lang;
    if (!isStr(a.voiceName))
        a.voiceName = '';
    s.audio = a;
    return s;
}
const TYPE_BASE = {
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
function cleanTypes(v) {
    if (!Array.isArray(v))
        return null;
    const byId = new Map(DEFAULT_TYPES.map((t) => [t.id, t]));
    const out = v
        .filter((t) => isObj(t) && isStr(t.id) && isStr(t.name))
        .map((t) => {
        const merged = { ...TYPE_BASE, ...(byId.get(t.id) ?? {}), ...t };
        merged.allowedApps = strings(merged.allowedApps);
        if (!(isNum(merged.focusMin) && merged.focusMin >= 5 && merged.focusMin <= 240))
            delete merged.focusMin;
        if (!(isNum(merged.breakMin) && merged.breakMin >= 0 && merged.breakMin <= 120))
            delete merged.breakMin;
        if (!isStr(merged.note))
            merged.note = '';
        if (!isStr(merged.firstStep))
            merged.firstStep = '';
        return merged;
    });
    return out.length ? out : null;
}
const stampOf = (env) => (env && isNum(env.updatedAt) ? env.updatedAt : 0);
function load() {
    const stamps = {};
    const s = readDoc('settings');
    const t = readDoc('types');
    const tp = readDoc('template');
    stamps.settings = stampOf(s);
    stamps.types = stampOf(t);
    stamps.template = stampOf(tp);
    const types = cleanTypes(t?.data) ?? DEFAULT_TYPES;
    const days = {};
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX + 'day:'))
            keys.push(k.slice(PREFIX.length));
    }
    for (const key of keys) {
        const env = readDoc(key);
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
    if (!isObj(s?.data) || !isStr(s.data.tiltStartDate)) {
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
let state = load();
function emit(changedKey) {
    listeners.forEach((l) => l());
    if (changedKey)
        changeListeners.forEach((l) => l(changedKey));
}
export function getState() {
    return state;
}
export function subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
}
/** Fires with the document key after a *local* edit (used by sync + scheduler). */
export function onLocalChange(l) {
    changeListeners.add(l);
    return () => changeListeners.delete(l);
}
export function useAppState() {
    return useSyncExternalStore(subscribe, getState, getState);
}
function docData(key, s = state) {
    if (key === 'settings')
        return s.settings;
    if (key === 'types')
        return s.typeOrder.map((id) => s.types[id]);
    if (key === 'template')
        return s.template;
    if (key.startsWith('day:'))
        return s.days[key.slice(4)];
    return undefined;
}
export function getDoc(key) {
    const data = docData(key);
    return data === undefined ? null : { data, updatedAt: state.stamps[key] ?? 0 };
}
export function allDocKeys() {
    return ['settings', 'types', 'template', ...Object.keys(state.days).map((d) => `day:${d}`)];
}
function commit(key, next, updatedAt, local) {
    state = { ...next, stamps: { ...next.stamps, [key]: updatedAt } };
    writeDoc(key, { data: docData(key, state), updatedAt });
    emit(local ? key : undefined);
}
/** Apply a document from the server or a backup. Returns true if it was newer and valid. */
export function applyRemote(key, data, updatedAt) {
    if (!isNum(updatedAt) || (state.stamps[key] ?? 0) >= updatedAt)
        return false;
    let next;
    if (key === 'settings') {
        if (!isObj(data))
            return false;
        next = { ...state, settings: cleanSettings(data) };
    }
    else if (key === 'types') {
        const list = cleanTypes(data);
        if (!list)
            return false;
        next = { ...state, types: Object.fromEntries(list.map((x) => [x.id, x])), typeOrder: list.map((x) => x.id) };
    }
    else if (key === 'template') {
        const list = cleanTemplate(data);
        if (!list)
            return false;
        next = { ...state, template: list };
    }
    else if (key.startsWith('day:')) {
        const day = cleanDay(key.slice(4), data);
        if (!day)
            return false;
        next = { ...state, days: { ...state.days, [key.slice(4)]: day } };
    }
    else
        return false;
    commit(key, next, updatedAt, false);
    return true;
}
export function updateSettings(fn) {
    commit('settings', { ...state, settings: fn(state.settings) }, Date.now(), true);
}
export function updateType(id, fn) {
    const t = state.types[id];
    if (!t)
        return;
    commit('types', { ...state, types: { ...state.types, [id]: fn(t) } }, Date.now(), true);
}
export function addType(t) {
    commit('types', { ...state, types: { ...state.types, [t.id]: t }, typeOrder: [...state.typeOrder, t.id] }, Date.now(), true);
}
/** How far back past days get their plan frozen (covers the 56-day program and 30-day stats). */
const FREEZE_WINDOW_DAYS = 120;
/**
 * Before the weekly template changes, give every past day that still follows
 * it a frozen copy, so stats and history keep the plan that day really had.
 */
function freezePastDays(oldTemplate) {
    const today = dateKey(new Date());
    let date = firstDay();
    const earliest = addDays(today, -FREEZE_WINDOW_DAYS);
    if (daysBetween(earliest, date) < 0)
        date = earliest;
    for (; daysBetween(date, today) > 0; date = addDays(date, 1)) {
        const day = state.days[date];
        if (day?.tpl)
            continue;
        const wd = weekday(date);
        const tpl = oldTemplate.filter((t) => t.days.includes(wd));
        commit(`day:${date}`, { ...state, days: { ...state.days, [date]: { ...(day ?? emptyDay(date)), tpl } } }, Date.now(), true);
    }
}
export function updateTemplate(fn) {
    const next = fn(state.template).slice().sort((a, b) => a.start - b.start);
    freezePastDays(state.template);
    commit('template', { ...state, template: next }, Date.now(), true);
}
export function getDay(date) {
    return state.days[date] ?? emptyDay(date);
}
export function updateDay(date, fn) {
    const next = fn(getDay(date));
    commit(`day:${date}`, { ...state, days: { ...state.days, [date]: next } }, Date.now(), true);
}
export function resetAll() {
    for (const key of allDocKeys())
        localStorage.removeItem(PREFIX + key);
    state = load();
    emit();
}
/** First day with any record — stats don't count days before the app existed. */
export function firstDay() {
    const keys = Object.keys(state.days).sort();
    return keys[0] ?? dateKey(new Date());
}
