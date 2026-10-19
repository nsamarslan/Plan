import { addDays, daysBetween, type DateKey } from '../lib/time';
import type { DayDoc } from './types';
import { workoutTotals } from './workout';

// History views over the day documents: weigh-ins, protein / water, workouts.

export const PROTEIN_GOAL = 130;
export const WATER_GOAL = 3;

const newestFirst = (days: Record<DateKey, DayDoc>) => Object.keys(days).sort().reverse();

/** Weigh-ins, newest first, with the change since the one before. */
export function weighIns(days: Record<DateKey, DayDoc>, limit = 10): { date: DateKey; kg: number; diff?: number }[] {
  const all = newestFirst(days)
    .map((date) => ({ date, kg: days[date].body?.kg }))
    .filter((x): x is { date: DateKey; kg: number } => x.kg !== undefined);
  return all.slice(0, limit).map((x, i) => {
    const prev = all[i + 1];
    return prev ? { ...x, diff: Math.round((x.kg - prev.kg) * 10) / 10 } : x;
  });
}

/** The latest weight logged before `date`. */
export function lastWeight(days: Record<DateKey, DayDoc>, date: DateKey): number | undefined {
  for (const d of newestFirst(days)) {
    if (daysBetween(d, date) > 0 && days[d].body?.kg !== undefined) return days[d].body!.kg;
  }
  return undefined;
}

/** Protein and water over the `n` days ending at `end`, counting only days with an entry. */
export function intake(days: Record<DateKey, DayDoc>, end: DateKey, n = 7) {
  let pDays = 0;
  let pSum = 0;
  let pHit = 0;
  let wDays = 0;
  let wSum = 0;
  let wHit = 0;
  for (let i = 0; i < n; i++) {
    const b = days[addDays(end, -i)]?.body;
    if (b?.protein !== undefined) {
      pDays++;
      pSum += b.protein;
      if (b.protein >= PROTEIN_GOAL) pHit++;
    }
    if (b?.water !== undefined) {
      wDays++;
      wSum += b.water;
      if (b.water >= WATER_GOAL) wHit++;
    }
  }
  return {
    protein: pDays ? Math.round(pSum / pDays) : undefined,
    proteinHit: pHit,
    proteinDays: pDays,
    water: wDays ? Math.round((wSum / wDays) * 10) / 10 : undefined,
    waterHit: wHit,
    waterDays: wDays,
  };
}

/** Logged workouts (at least one set done), newest first. */
export function recentWorkouts(days: Record<DateKey, DayDoc>, limit = 8) {
  const out: { date: DateKey; name: string; done: number; total: number; volume: number }[] = [];
  for (const date of newestFirst(days)) {
    const w = days[date].workout;
    if (!w) continue;
    const t = workoutTotals(w);
    if (t.done) out.push({ date, name: w.name, ...t });
    if (out.length >= limit) break;
  }
  return out;
}
