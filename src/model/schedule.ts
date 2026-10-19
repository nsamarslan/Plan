import { addDays, dateKey, DAY_MIN, daysBetween, minutesOfDay, MIN_MS, msAt, wallMinutes, weekday, type DateKey, type Minutes } from '../lib/time';
import type {
  BlockType,
  DayDoc,
  EffectiveStatus,
  ItemLog,
  ItemOverride,
  ResolvedItem,
  TemplateItem,
} from './types';
import { blockPlan } from './roadmap';

export function emptyDay(date: DateKey): DayDoc {
  return { date, mode: 'normal', overrides: {}, extras: [], logs: {} };
}

/** A day off: no notifications, no focus lock, not counted in stats. */
export const isOffDay = (day: DayDoc | undefined) => day?.mode === 'off';

const PENDING: ItemLog = { status: 'pending' };

const validStart = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const validDuration = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 5;

/** Template + this day's overrides → the concrete, time-sorted plan for the day. */
export function resolveDay(
  date: DateKey,
  template: TemplateItem[],
  types: Record<string, BlockType>,
  day: DayDoc | undefined,
): ResolvedItem[] {
  const doc = day ?? emptyDay(date);
  const wd = weekday(date);
  const minimal = doc.mode === 'minimal';
  const out: ResolvedItem[] = [];

  const add = (t: TemplateItem, extra: boolean) => {
    const type = types[t.typeId];
    if (!type) return;
    const ov: ItemOverride = doc.overrides[t.id] ?? {};
    if (ov.removed) return;
    // Minimal mode hides non-essential items, unless already started/finished today.
    if (minimal && !extra && !t.minimal && !doc.logs[t.id]) return;
    const baseDuration = minimal && validDuration(t.minimalDuration) ? t.minimalDuration! : t.duration;
    const start = validStart(ov.start) ? ov.start! : t.start;
    const duration = validDuration(ov.duration) ? ov.duration! : baseDuration;
    // Never let one broken record (e.g. a cleared time input) break the whole day.
    if (!validStart(start) || !validDuration(duration)) return;
    // The roadmap names the block for this date (e.g. "Upper A", "System Design");
    // a label typed into the template still wins.
    const plan = blockPlan(t.typeId, date);
    out.push({
      id: t.id,
      typeId: t.typeId,
      type: plan?.firstStep ? { ...type, firstStep: plan.firstStep } : type,
      label: t.label || plan?.label || type.name,
      ...(plan?.detail ? { detail: plan.detail } : {}),
      start,
      end: start + duration,
      duration,
      dnd: ov.dnd ?? t.dnd ?? type.dnd,
      log: doc.logs[t.id] ?? PENDING,
      extra,
      moved: ov.start !== undefined || ov.duration !== undefined,
    });
  };

  // A past day keeps the plan it had (`tpl`), so later template edits
  // don't rewrite history.
  for (const t of doc.tpl ?? template) if (Array.isArray(t.days) && t.days.includes(wd)) add(t, false);
  for (const t of doc.extras) add(t, true);
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

/** A pause this long ends the block by itself (it was most likely forgotten). */
export const PAUSE_LIMIT_MIN = 180;

export function effectiveStatus(item: ResolvedItem, date: DateKey, nowMs: number): EffectiveStatus {
  const { status, pausedAt } = item.log;
  if (status === 'done') return 'done';
  if (status === 'skipped') return 'skipped';
  const endMs = msAt(date, item.end);
  if (status === 'active') {
    // A paused block waits for "Devam et", even past its planned end.
    if (pausedAt !== undefined) return nowMs - pausedAt < PAUSE_LIMIT_MIN * MIN_MS ? 'active' : 'done';
    return nowMs >= endMs ? 'done' : 'active';
  }
  if (nowMs >= endMs) return 'missed';
  return nowMs >= msAt(date, item.start) ? 'late' : 'upcoming';
}

export interface NowState {
  current?: ResolvedItem;
  currentStatus?: EffectiveStatus;
  next?: ResolvedItem;
}

/** What should be on screen right now. */
export function nowState(items: ResolvedItem[], date: DateKey, nowMs: number): NowState {
  let current: ResolvedItem | undefined;
  let currentStatus: EffectiveStatus | undefined;
  for (const it of items) {
    const st = effectiveStatus(it, date, nowMs);
    if (st === 'active' || st === 'late') {
      // Prefer a block that was actually started over one merely due.
      if (!current || (st === 'active' && currentStatus !== 'active')) {
        current = it;
        currentStatus = st;
      }
    }
  }
  const next = items.find(
    (it) => it !== current && effectiveStatus(it, date, nowMs) === 'upcoming',
  );
  return { current, currentStatus, next };
}

export interface NowStateAt extends NowState {
  /** The calendar day `current` belongs to (yesterday for a block running past midnight). */
  currentDate: DateKey;
}

/** Like nowState, but a block from yesterday that runs past midnight still counts. */
export function nowStateAround(
  today: DateKey,
  template: TemplateItem[],
  types: Record<string, BlockType>,
  days: Record<DateKey, DayDoc>,
  nowMs: number,
): NowStateAt {
  // An off day has nothing to do; yesterday's late-night block may still run.
  const items = isOffDay(days[today]) ? [] : resolveDay(today, template, types, days[today]);
  const st = nowState(items, today, nowMs);
  if (st.currentStatus === 'active') return { ...st, currentDate: today };
  const y = addDays(today, -1);
  const carry = isOffDay(days[y]) ? [] : resolveDay(y, template, types, days[y]).filter((i) => i.end > DAY_MIN);
  const prev = nowState(carry, y, nowMs);
  if (prev.current && (!st.current || prev.currentStatus === 'active')) {
    return { current: prev.current, currentStatus: prev.currentStatus, next: st.next, currentDate: y };
  }
  return { ...st, currentDate: today };
}

function setOverride(day: DayDoc, id: string, patch: ItemOverride): DayDoc {
  return { ...day, overrides: { ...day.overrides, [id]: { ...day.overrides[id], ...patch } } };
}

/**
 * Move one item to `newStart`. Later items that would overlap are pushed
 * forward just enough, until a gap absorbs the shift. Finished items stay put.
 */
export function moveItem(
  day: DayDoc,
  items: ResolvedItem[],
  id: string,
  newStart: Minutes,
  cascade = true,
): DayDoc {
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return day;
  const target = items[idx];
  let next = setOverride(day, id, { start: Math.round(newStart) });
  if (!cascade) return next;
  const start = Math.round(newStart);
  let prevEnd = start + target.duration;
  const later = items
    .filter(
      (i) =>
        i.id !== id &&
        i.start >= start &&
        i.log.status !== 'done' &&
        i.log.status !== 'skipped' &&
        i.log.status !== 'active',
    )
    .sort((a, b) => a.start - b.start);
  for (const it of later) {
    if (it.start >= prevEnd) break;
    next = setOverride(next, it.id, { start: prevEnd });
    prevEnd = prevEnd + it.duration;
  }
  return next;
}

const isOpen = (i: ResolvedItem) => i.log.status !== 'done' && i.log.status !== 'skipped' && i.log.status !== 'active';

/** Push the open blocks that start at or after `from` (other than `target`) so
 *  none starts before `prevEnd`; stops at the first gap that absorbs the shift. */
function pushAfter(day: DayDoc, items: ResolvedItem[], target: ResolvedItem, from: number, prevEnd: number): DayDoc {
  let next = day;
  const after = items
    .filter(
      (i) =>
        i.id !== target.id &&
        isOpen(i) &&
        (i.start > from || (i.start === from && (from !== target.start || i.end >= target.end))),
    )
    .sort((a, b) => a.start - b.start);
  for (const it of after) {
    if (it.start >= prevEnd) break;
    next = setOverride(next, it.id, { start: prevEnd });
    prevEnd += it.duration;
  }
  return next;
}

/**
 * Snooze / starting now: the block moves to `newStart`. Later: everything
 * planned after it moves along, so it keeps its place in the order. Earlier:
 * blocks it now overlaps move after it (you are doing this one now).
 */
export function postponeItem(day: DayDoc, items: ResolvedItem[], id: string, newStart: Minutes): DayDoc {
  const target = items.find((i) => i.id === id);
  if (!target) return day;
  const start = Math.round(newStart);
  return pushAfter(setOverride(day, id, { start }), items, target, Math.min(start, target.start), start + target.duration);
}

/** Longer blocks push the following ones, the same way moving does. */
export function setDuration(day: DayDoc, items: ResolvedItem[], id: string, duration: number): DayDoc {
  const d = Math.max(5, Math.round(duration));
  const target = items.find((i) => i.id === id);
  const next = setOverride(day, id, { duration: d });
  return target ? pushAfter(next, items, target, target.start, target.start + d) : next;
}

function setLog(day: DayDoc, id: string, log: ItemLog): DayDoc {
  return { ...day, logs: { ...day.logs, [id]: log } };
}

/** Grace period: starting this late (or this early) keeps the plan as is. */
export const START_GRACE_MIN = 5;

/** "Başladım". Starting more than a few minutes off-plan moves the block to
 *  now and pushes what comes after it. */
export function startItem(
  day: DayDoc,
  items: ResolvedItem[],
  id: string,
  nowMs: number,
): DayDoc {
  const it = items.find((i) => i.id === id);
  if (!it) return day;
  // Wall-clock minutes (DST-safe); a start after midnight counts past 24:00.
  const now = new Date(nowMs);
  const nowMin = daysBetween(day.date, dateKey(now)) * DAY_MIN + minutesOfDay(now);
  let next = day;
  if (Math.abs(nowMin - it.start) > START_GRACE_MIN) {
    next = postponeItem(day, items, id, Math.floor(nowMin));
  }
  // One thing at a time: a block still running ends when another one starts.
  for (const o of items) {
    if (o.id !== id && o.log.status === 'active') next = finishItem(next, o.id, nowMs);
  }
  return setLog(next, id, { status: 'active', startedAt: nowMs });
}

export function finishItem(day: DayDoc, id: string, nowMs: number): DayDoc {
  const prev = day.logs[id];
  // Finished during a pause: the work stopped when the pause began.
  const log: ItemLog = { status: 'done', startedAt: prev?.startedAt, endedAt: prev?.pausedAt ?? nowMs };
  if (prev?.pausedMs) log.pausedMs = prev.pausedMs;
  return setLog(day, id, log);
}

/** "Duraklat": something came up. The timer stops and focus mode lets go. */
export function pauseItem(day: DayDoc, id: string, nowMs: number): DayDoc {
  const log = day.logs[id];
  if (!log || log.status !== 'active' || log.pausedAt !== undefined) return day;
  return setLog(day, id, { ...log, pausedAt: nowMs });
}

/** "Devam et": the block gets the paused minutes back (later blocks move
 *  along), and the pause is kept out of the work time. */
export function resumeItem(day: DayDoc, items: ResolvedItem[], id: string, nowMs: number): DayDoc {
  const it = items.find((i) => i.id === id);
  const log = day.logs[id];
  if (!it || !log || log.status !== 'active' || log.pausedAt === undefined) return day;
  // Whole minutes, so the extension and the recorded pause always match.
  const addMin = Math.max(0, Math.round((nowMs - log.pausedAt) / MIN_MS));
  const next = addMin ? setDuration(day, items, id, it.duration + addMin) : day;
  const resumed: ItemLog = { ...log, pausedMs: (log.pausedMs ?? 0) + addMin * MIN_MS };
  delete resumed.pausedAt;
  return setLog(next, id, resumed);
}

/** Minutes earlier pauses added to the block. */
export const pausedMinutes = (log: ItemLog) => (log.pausedMs ?? 0) / MIN_MS;

/** The block's planned work time: its length minus what pauses added. */
export function workMinutes(item: ResolvedItem): number {
  return Math.max(5, item.duration - pausedMinutes(item.log));
}

/** "+10 dk" from a notification or the Şimdi screen. */
export const SNOOZE_MIN = 10;

/**
 * Snooze before a block starts: it moves to 10 minutes from now (from its
 * start, if that is later), and what follows moves along. If the block right
 * before it is still running, that one gets the extra time instead.
 */
export function snoozeItem(day: DayDoc, items: ResolvedItem[], id: string, tapMs: number, min = SNOOZE_MIN): DayDoc {
  const it = items.find((i) => i.id === id);
  if (!it) return day;
  const tap = wallMinutes(day.date, tapMs);
  const newStart = Math.ceil(Math.max(it.start, tap)) + min;
  const running = items.find(
    (o) => o.id !== id && o.log.status === 'active' && o.log.pausedAt === undefined && Math.abs(o.end - it.start) <= 2 && o.start <= tap,
  );
  if (running) return setDuration(day, items, running.id, newStart - running.start);
  return postponeItem(day, items, id, newStart);
}

/**
 * More time at the end of a block: it runs 10 more minutes (from now, if it
 * already ended) and later blocks move along. Asking for more time means you
 * were on it, so a block never marked as started counts as started.
 */
export function extendItem(day: DayDoc, items: ResolvedItem[], id: string, tapMs: number, min = SNOOZE_MIN): DayDoc {
  const it = items.find((i) => i.id === id);
  if (!it) return day;
  const newEnd = Math.ceil(Math.max(it.end, wallMinutes(day.date, tapMs))) + min;
  const next = setDuration(day, items, id, newEnd - it.start);
  return it.log.status === 'pending' ? setLog(next, id, { status: 'active', startedAt: msAt(day.date, it.start) }) : next;
}

export function skipItem(day: DayDoc, id: string): DayDoc {
  return setLog(day, id, { status: 'skipped' });
}

export function resetItem(day: DayDoc, id: string): DayDoc {
  const logs = { ...day.logs };
  delete logs[id];
  return { ...day, logs };
}

export function removeItem(day: DayDoc, id: string): DayDoc {
  const extra = day.extras.find((e) => e.id === id);
  if (extra) return { ...day, extras: day.extras.filter((e) => e.id !== id) };
  return setOverride(day, id, { removed: true });
}

export function addExtra(day: DayDoc, item: TemplateItem): DayDoc {
  return { ...day, extras: [...day.extras, item] };
}

/** Undo every time change for one item on this day. */
export function clearOverride(day: DayDoc, id: string): DayDoc {
  const overrides = { ...day.overrides };
  delete overrides[id];
  return { ...day, overrides };
}

export const DEFAULT_FOCUS_MIN = 50;
export const DEFAULT_BREAK_MIN = 10;

export interface PomodoroPhase {
  kind: 'focus' | 'break';
  /** Minutes from the block start. */
  start: number;
  end: number;
}

/** Focus / break minutes for a block type (defaults 50 / 10). */
export function pomodoroLengths(type: Pick<BlockType, 'focusMin' | 'breakMin'>): { focus: number; brk: number } {
  const focus = Number.isFinite(type.focusMin) && type.focusMin! >= 5 ? Math.round(type.focusMin!) : DEFAULT_FOCUS_MIN;
  const brk = Number.isFinite(type.breakMin) && type.breakMin! >= 0 ? Math.round(type.breakMin!) : DEFAULT_BREAK_MIN;
  return { focus, brk };
}

/** Pomodoro phases inside a block; the last phase may be shorter. A 0-minute break means one long focus. */
export function pomodoroPhases(duration: number, focus = DEFAULT_FOCUS_MIN, brk = DEFAULT_BREAK_MIN): PomodoroPhase[] {
  const out: PomodoroPhase[] = [];
  const f = Math.max(5, focus);
  let t = 0;
  while (t < duration) {
    const fEnd = brk > 0 ? Math.min(duration, t + f) : duration;
    out.push({ kind: 'focus', start: t, end: fEnd });
    t = fEnd;
    if (t >= duration) break;
    const bEnd = Math.min(duration, t + brk);
    out.push({ kind: 'break', start: t, end: bEnd });
    t = bEnd;
  }
  return out;
}

export interface PomodoroState {
  phases: PomodoroPhase[];
  index: number;
  phase: PomodoroPhase;
  /** 1-based number of the current (or last) focus phase, and how many there are. */
  focusNo: number;
  focusTotal: number;
  /** Seconds left in the current phase / in the whole block. */
  phaseLeftSec: number;
  phaseTotalSec: number;
  elapsedMin: number;
}

/** Where a pomodoro block is at `nowMs`. Phases are counted from the block's
 *  planned start over its work time; pauses don't count and freeze it. */
export function pomodoroAt(item: ResolvedItem, date: DateKey, nowMs: number): PomodoroState {
  const { focus, brk } = pomodoroLengths(item.type);
  const { pausedAt, pausedMs = 0 } = item.log;
  return phaseStateAt(pomodoroPhases(workMinutes(item), focus, brk), msAt(date, item.start) + pausedMs, pausedAt ?? nowMs);
}

/** Phase state for any run of phases that started at `startMs`. */
export function phaseStateAt(phases: PomodoroPhase[], startMs: number, nowMs: number): PomodoroState {
  const duration = phases.length ? phases[phases.length - 1].end : 0;
  const elapsedMin = Math.min(duration, Math.max(0, (nowMs - startMs) / 60_000));
  let index = phases.findIndex((p) => elapsedMin >= p.start && elapsedMin < p.end);
  if (index < 0) index = phases.length - 1;
  const phase = phases[index];
  return {
    phases,
    index,
    phase,
    focusNo: phases.slice(0, index + 1).filter((p) => p.kind === 'focus').length,
    focusTotal: phases.filter((p) => p.kind === 'focus').length,
    phaseLeftSec: Math.max(0, (phase.end - elapsedMin) * 60),
    phaseTotalSec: (phase.end - phase.start) * 60,
    elapsedMin,
  };
}

export function uid(prefix = 'x'): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
