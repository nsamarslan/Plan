import { daysBetween, weekday, type DateKey } from '../lib/time';
import type { NotifyEvent } from './notify';
import { programSets, WORKOUTS } from './roadmap';
import type { DayDoc, ExerciseLog, ExercisePref, SetLog, WorkoutLog } from './types';

// The weight training log. It lives in the day's document (DayDoc.workout),
// so it syncs and is backed up with the rest of the day. Until the first set
// is touched the screen shows the program with last time's numbers; the log
// is saved from that first edit on.

export const REST_MIN_SEC = 15;
export const REST_MAX_SEC = 600;
export const MAX_SETS = 10;

export const clampRest = (sec: number) => Math.min(REST_MAX_SEC, Math.max(REST_MIN_SEC, Math.round(sec / 5) * 5));

/** The program's workout for `date` (or the one named), as an unsaved log. */
export function plannedWorkout(date: DateKey, prefs: Record<string, ExercisePref>, name?: string): WorkoutLog | undefined {
  const w = name ? Object.values(WORKOUTS).find((x) => x.name === name) : WORKOUTS[weekday(date)];
  if (!w) return undefined;
  return {
    name: w.name,
    exercises: w.moves.map(([ex, sets, reps, restSec]) => {
      const p = prefs[ex] ?? {};
      const n = p.sets ?? programSets(date, sets);
      return { name: ex, reps, restSec: p.restSec ?? restSec, sets: Array.from({ length: n }, () => ({})) };
    }),
  };
}

export const WORKOUT_NAMES = Object.values(WORKOUTS).map((w) => w.name);

/** The program's full set count for an exercise (before the restart's one-less). */
export function baseSets(name: string): number | undefined {
  for (const w of Object.values(WORKOUTS)) {
    const m = w.moves.find(([n]) => n === name);
    if (m) return m[1];
  }
  return undefined;
}

export interface PastSets {
  date: DateKey;
  sets: SetLog[];
}

/** The latest days this exercise was logged before `before`, newest first (done sets only). */
export function exerciseHistory(days: Record<DateKey, DayDoc>, name: string, before: DateKey, limit = 3): PastSets[] {
  const out: PastSets[] = [];
  for (const date of Object.keys(days).sort().reverse()) {
    if (daysBetween(date, before) <= 0) continue;
    const sets = days[date].workout?.exercises.find((e) => e.name === name)?.sets.filter((x) => x.done) ?? [];
    if (sets.length) out.push({ date, sets });
    if (out.length >= limit) break;
  }
  return out;
}

/** Highest number in a target like "6-8", "8-10/bacak" or "30-60 sn"; none for "maks". */
export function topReps(reps: string): number | undefined {
  const nums = reps.match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : undefined;
}

/** Last time every set reached the top of the range: time to add weight. */
export function readyToAdd(last: PastSets | undefined, reps: string): boolean {
  const top = topReps(reps);
  if (!last || top === undefined) return false;
  return last.sets.every((x) => x.reps !== undefined && x.reps >= top);
}

/** Barbell lifts go up by the smallest plate pair; dumbbells by the next pair, typed by hand. */
const STEP_KG = 2.5;
const isBarbell = (name: string) => name.startsWith('Barbell');

/**
 * What to put in an empty set row. Weight: today's earlier set if there is
 * one (the working weight you picked), else last time's same set (+2.5 kg on a
 * barbell once every set reached the top). Reps: the top of the range.
 */
export function setHint(name: string, reps: string, last: PastSets | undefined, i: number, today: SetLog[] = []): SetLog {
  const prev = last?.sets[Math.min(i, last.sets.length - 1)];
  let kg = prev?.kg;
  if (kg !== undefined && isBarbell(name) && readyToAdd(last, reps)) kg += STEP_KG;
  const earlier = today.slice(0, i).reverse().find((x) => x.kg !== undefined);
  return { kg: earlier?.kg ?? kg, reps: topReps(reps) ?? prev?.reps };
}

const mapEx = (w: WorkoutLog, ei: number, fn: (e: ExerciseLog) => ExerciseLog): WorkoutLog => ({
  ...w,
  exercises: w.exercises.map((e, i) => (i === ei ? fn(e) : e)),
});

export const updateSet = (w: WorkoutLog, ei: number, si: number, patch: SetLog) =>
  mapEx(w, ei, (e) => ({ ...e, sets: e.sets.map((x, i) => (i === si ? { ...x, ...patch } : x)) }));

export const addSet = (w: WorkoutLog, ei: number) =>
  mapEx(w, ei, (e) => (e.sets.length >= MAX_SETS ? e : { ...e, sets: [...e.sets, {}] }));

export const removeSet = (w: WorkoutLog, ei: number) =>
  mapEx(w, ei, (e) => (e.sets.length <= 1 ? e : { ...e, sets: e.sets.slice(0, -1) }));

export const setRest = (w: WorkoutLog, ei: number, sec: number) => mapEx(w, ei, (e) => ({ ...e, restSec: clampRest(sec) }));

/** The first set not done yet, looking from exercise `fromEi` on. */
export function nextSet(w: WorkoutLog, fromEi = 0): { ei: number; si: number } | undefined {
  for (let ei = fromEi; ei < w.exercises.length; ei++) {
    const si = w.exercises[ei].sets.findIndex((x) => !x.done);
    if (si >= 0) return { ei, si };
  }
  return fromEi > 0 ? nextSet(w, 0) : undefined;
}

export function workoutTotals(w: WorkoutLog | undefined) {
  let done = 0;
  let total = 0;
  let volume = 0;
  for (const e of w?.exercises ?? []) {
    total += e.sets.length;
    for (const x of e.sets) {
      if (!x.done) continue;
      done++;
      volume += (x.kg ?? 0) * (x.reps ?? 0);
    }
  }
  return { done, total, volume: Math.round(volume) };
}

/** "60×8" / "×12" (bodyweight) / "60×?" */
export const fmtSet = (x: SetLog) => `${x.kg ?? ''}×${x.reps ?? '?'}`;

// ---- Rest timer ------------------------------------------------------------

export interface RestTimer {
  endsAt: number;
  totalSec: number;
  /** What comes next, e.g. "Barbell Bench Press · 3. set". */
  label: string;
}

export const REST_COLOR = '#f97316';

/** One notification (with sound, also on a locked phone) when the rest is over. */
export function restEvents(r: RestTimer | null, nowMs: number): NotifyEvent[] {
  if (!r || r.endsAt < nowMs - 30_000) return [];
  return [
    {
      id: `rest|${r.endsAt}`,
      itemKey: 'rest',
      kind: 'cue',
      at: r.endsAt,
      title: 'Dinlenme bitti',
      body: r.label ? `Sıradaki: ${r.label}` : 'Sıradaki sete geç.',
      color: REST_COLOR,
      art: 'weights',
      fullScreen: false,
    },
  ];
}
