import { addDays, daysBetween, weekday, type DateKey } from '../lib/time';
import { effectiveStatus, isOffDay, resolveDay, workMinutes } from './schedule';
import type { BlockType, DayDoc, ResolvedItem, TemplateItem } from './types';

export interface DayStats {
  date: DateKey;
  planned: number;
  done: number;
  skipped: number;
  missed: number;
  plannedMin: number;
  doneMin: number;
  onTime: number;
  /** Items whose end is still in the future (not judged yet). */
  open: number;
  /** A day off: nothing on it counts. */
  off: boolean;
}

/** Real work time: from start to finish, minus pauses. */
function doneMinutes(it: ResolvedItem): number {
  const work = workMinutes(it);
  const { startedAt, pausedAt, pausedMs = 0 } = it.log;
  // A block that ended by itself during a pause stopped at the pause.
  const endedAt = it.log.endedAt ?? pausedAt;
  if (startedAt && endedAt) return Math.min(work, Math.max(0, (endedAt - startedAt - pausedMs) / 60_000));
  return work;
}

export function dayStats(date: DateKey, items: ResolvedItem[], nowMs: number, off = false): DayStats {
  const s: DayStats = { date, planned: 0, done: 0, skipped: 0, missed: 0, plannedMin: 0, doneMin: 0, onTime: 0, open: 0, off };
  if (off) return s;
  for (const it of items) {
    if (!it.type.tracked) continue;
    s.planned++;
    s.plannedMin += workMinutes(it);
    const st = effectiveStatus(it, date, nowMs);
    if (st === 'done') {
      s.done++;
      s.doneMin += doneMinutes(it);
      if (it.log.startedAt !== undefined) s.onTime++;
    } else if (st === 'skipped') s.skipped++;
    else if (st === 'missed') s.missed++;
    else s.open++;
  }
  return s;
}

export function pct(n: number, d: number): number {
  return d ? Math.round((n / d) * 100) : 0;
}

export interface TypeStats {
  type: BlockType;
  planned: number;
  done: number;
  /** Skipped or let pass. */
  missed: number;
  doneMin: number;
  plannedMin: number;
}

export interface RangeInput {
  end: DateKey;
  days: number;
  nowMs: number;
  template: TemplateItem[];
  types: Record<string, BlockType>;
  dayDocs: Record<string, DayDoc>;
  /** Days before this one are not counted (the app wasn't used yet). */
  since?: DateKey;
}

export function rangeStats(input: RangeInput): { days: DayStats[]; byType: TypeStats[] } {
  const { end, days, nowMs, template, types, dayDocs, since } = input;
  const out: DayStats[] = [];
  const byType = new Map<string, TypeStats>();
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    if (since && daysBetween(since, date) < 0) continue;
    const items = resolveDay(date, template, types, dayDocs[date]);
    const off = isOffDay(dayDocs[date]);
    out.push(dayStats(date, items, nowMs, off));
    if (off) continue;
    for (const it of items) {
      if (!it.type.tracked) continue;
      const t = byType.get(it.typeId) ?? { type: it.type, planned: 0, done: 0, missed: 0, doneMin: 0, plannedMin: 0 };
      t.planned++;
      t.plannedMin += workMinutes(it);
      const st = effectiveStatus(it, date, nowMs);
      if (st === 'done') {
        t.done++;
        t.doneMin += doneMinutes(it);
      } else if (st === 'missed' || st === 'skipped') t.missed++;
      byType.set(it.typeId, t);
    }
  }
  return { days: out, byType: [...byType.values()] };
}

/** Consecutive days (ending today or yesterday) with ≥ 80% of blocks done.
 *  Days off neither count nor break it. */
export function streak(days: DayStats[]): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.off) continue;
    const judged = d.planned - d.open;
    if (i === days.length - 1 && d.open > 0 && pct(d.done, d.planned) < 80) continue;
    if (judged === 0 || pct(d.done, d.planned) < 80) break;
    n++;
  }
  return n;
}

/** Monday of the (Monday–Sunday) week that contains `date`. */
export function weekStart(date: DateKey): DateKey {
  return addDays(date, -((weekday(date) + 6) % 7));
}

export interface WeekSummary {
  monday: DateKey;
  /** Blocks whose time has passed, and how many of them were done. */
  judged: number;
  done: number;
  pct: number;
  doneMin: number;
  offDays: number;
  /** The block let go most often (skipped or missed), if any was. */
  worst?: TypeStats;
}

export function weekSummary(input: Omit<RangeInput, 'end' | 'days'> & { monday: DateKey }): WeekSummary {
  const { monday, ...rest } = input;
  const r = rangeStats({ ...rest, end: addDays(monday, 6), days: 7 });
  const judged = r.days.reduce((a, d) => a + d.planned - d.open, 0);
  const done = r.days.reduce((a, d) => a + d.done, 0);
  const worst = r.byType
    .filter((t) => t.missed > 0)
    .sort((a, b) => b.missed - a.missed || a.done / a.planned - b.done / b.planned)[0];
  return {
    monday,
    judged,
    done,
    pct: pct(done, judged),
    doneMin: r.days.reduce((a, d) => a + d.doneMin, 0),
    offDays: r.days.filter((d) => d.off).length,
    worst,
  };
}
