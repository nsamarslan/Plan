import { msAt, weekday, type DateKey, type Minutes, MIN_MS } from '../lib/time';
import type {
  BlockType,
  DayDoc,
  EffectiveStatus,
  ItemLog,
  ItemOverride,
  ResolvedItem,
  TemplateItem,
} from './types';

export function emptyDay(date: DateKey): DayDoc {
  return { date, mode: 'normal', overrides: {}, extras: [], logs: {} };
}

const PENDING: ItemLog = { status: 'pending' };

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
    const baseDuration = minimal && t.minimalDuration ? t.minimalDuration : t.duration;
    const start = ov.start ?? t.start;
    const duration = ov.duration ?? baseDuration;
    out.push({
      id: t.id,
      typeId: t.typeId,
      type,
      label: t.label || type.name,
      start,
      end: start + duration,
      duration,
      dnd: ov.dnd ?? t.dnd ?? type.dnd,
      log: doc.logs[t.id] ?? PENDING,
      extra,
      moved: ov.start !== undefined || ov.duration !== undefined,
    });
  };

  for (const t of template) if (t.days.includes(wd)) add(t, false);
  for (const t of doc.extras) add(t, true);
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

export function effectiveStatus(item: ResolvedItem, date: DateKey, nowMs: number): EffectiveStatus {
  const { status } = item.log;
  if (status === 'done') return 'done';
  if (status === 'skipped') return 'skipped';
  const endMs = msAt(date, item.end);
  if (status === 'active') return nowMs >= endMs ? 'done' : 'active';
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

export function setDuration(day: DayDoc, id: string, duration: number): DayDoc {
  return setOverride(day, id, { duration: Math.max(5, Math.round(duration)) });
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
  const nowMin = (nowMs - msAt(day.date, 0)) / MIN_MS;
  let next = day;
  if (Math.abs(nowMin - it.start) > START_GRACE_MIN) {
    next = moveItem(day, items, id, Math.floor(nowMin));
  }
  return setLog(next, id, { status: 'active', startedAt: nowMs });
}

export function finishItem(day: DayDoc, id: string, nowMs: number): DayDoc {
  const prev = day.logs[id];
  return setLog(day, id, { status: 'done', startedAt: prev?.startedAt, endedAt: nowMs });
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

/** Pomodoro phases inside a block: 50 focus / 10 break, last phase may be shorter. */
export function pomodoroPhases(duration: number): { kind: 'focus' | 'break'; start: number; end: number }[] {
  const out: { kind: 'focus' | 'break'; start: number; end: number }[] = [];
  let t = 0;
  while (t < duration) {
    const fEnd = Math.min(duration, t + 50);
    out.push({ kind: 'focus', start: t, end: fEnd });
    t = fEnd;
    if (t >= duration) break;
    const bEnd = Math.min(duration, t + 10);
    out.push({ kind: 'break', start: t, end: bEnd });
    t = bEnd;
  }
  return out;
}

export function uid(prefix = 'x'): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
