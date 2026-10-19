import { describe, expect, it, vi } from 'vitest';
import { intake, lastWeight, recentWorkouts, weighIns } from './body';
import { emptyDay } from './schedule';
import type { DayDoc, WorkoutLog } from './types';
import {
  addSet,
  clampRest,
  exerciseHistory,
  MAX_SETS,
  nextSet,
  plannedWorkout,
  readyToAdd,
  removeSet,
  restEvents,
  setHint,
  topReps,
  updateSet,
  workoutTotals,
} from './workout';

const MON = '2026-10-19';
const WED = '2026-10-21';
const MON2 = '2026-10-26';
const NOV_MON = '2026-11-02';

const day = (date: string, patch: Partial<DayDoc>): DayDoc => ({ ...emptyDay(date), ...patch });
const done = (kg: number | undefined, reps: number) => ({ kg, reps, done: true });

describe('planned workout', () => {
  it('builds the weekday workout with restart sets and per-exercise rest', () => {
    const w = plannedWorkout(MON, {})!;
    expect(w.name).toBe('Upper A');
    expect(w.exercises.map((e) => e.sets.length)).toEqual([3, 3, 2, 2, 2, 2]);
    expect(w.exercises[0]).toMatchObject({ name: 'Barbell Bench Press', reps: '6-8', restSec: 120 });
    expect(w.exercises.find((e) => e.name === 'Dumbbell Curl')!.restSec).toBe(60);
    expect(plannedWorkout(NOV_MON, {})!.exercises[0].sets.length).toBe(4);
  });

  it('uses the remembered rest and set count', () => {
    const w = plannedWorkout(MON, { 'Barbell Bench Press': { restSec: 150, sets: 5 } })!;
    expect(w.exercises[0].restSec).toBe(150);
    expect(w.exercises[0].sets.length).toBe(5);
  });

  it('has nothing on a rest day unless one is picked', () => {
    expect(plannedWorkout(WED, {})).toBeUndefined();
    expect(plannedWorkout(WED, {}, 'Lower B')!.exercises[0].name).toBe('Barbell Deadlift');
  });
});

describe('sets', () => {
  const base = plannedWorkout(MON, {})!;

  it('adds and removes sets within bounds', () => {
    expect(addSet(base, 0).exercises[0].sets.length).toBe(4);
    expect(removeSet(base, 0).exercises[0].sets.length).toBe(2);
    let one = base;
    for (let i = 0; i < 5; i++) one = removeSet(one, 2);
    expect(one.exercises[2].sets.length).toBe(1);
    let many = base;
    for (let i = 0; i < 20; i++) many = addSet(many, 0);
    expect(many.exercises[0].sets.length).toBe(MAX_SETS);
  });

  it('finds the next open set, then wraps to earlier skipped ones', () => {
    let w = updateSet(base, 0, 0, done(60, 8));
    expect(nextSet(w, 0)).toEqual({ ei: 0, si: 1 });
    w = updateSet(updateSet(w, 0, 1, done(60, 8)), 0, 2, done(60, 7));
    expect(nextSet(w, 0)).toEqual({ ei: 1, si: 0 });
    // Everything after exercise 4 done, exercise 1 still open.
    let tail = base;
    for (let ei = 4; ei < tail.exercises.length; ei++)
      for (let si = 0; si < tail.exercises[ei].sets.length; si++) tail = updateSet(tail, ei, si, done(10, 12));
    expect(nextSet(tail, 5)).toEqual({ ei: 0, si: 0 });
  });

  it('totals done sets and volume', () => {
    const w = updateSet(updateSet(base, 0, 0, done(60, 8)), 3, 0, done(undefined, 6));
    expect(workoutTotals(w)).toEqual({ done: 2, total: 14, volume: 480 });
  });

  it('clamps rest to 15 s – 10 min in 5 s steps', () => {
    expect(clampRest(3)).toBe(15);
    expect(clampRest(92)).toBe(90);
    expect(clampRest(9999)).toBe(600);
  });
});

describe('history and suggestions', () => {
  const log = (sets: ReturnType<typeof done>[]): WorkoutLog => ({
    name: 'Upper A',
    exercises: [{ name: 'Barbell Bench Press', reps: '6-8', restSec: 120, sets: [...sets, {}] }],
  });
  const days: Record<string, DayDoc> = {
    '2026-10-05': day('2026-10-05', { workout: log([done(55, 8), done(55, 7)]) }),
    '2026-10-12': day('2026-10-12', { workout: log([done(57.5, 8), done(57.5, 8), done(57.5, 8)]) }),
    [MON]: day(MON, { workout: log([done(60, 6)]) }),
  };

  it('lists earlier sessions newest first, done sets only, not today', () => {
    const h = exerciseHistory(days, 'Barbell Bench Press', MON, 3);
    expect(h.map((x) => x.date)).toEqual(['2026-10-12', '2026-10-05']);
    expect(h[0].sets).toHaveLength(3);
    expect(exerciseHistory(days, 'Barbell Bench Press', MON2, 1)[0].date).toBe(MON);
  });

  it('reads the top of a rep range', () => {
    expect(topReps('6-8')).toBe(8);
    expect(topReps('8-10/bacak')).toBe(10);
    expect(topReps('30-60 sn')).toBe(60);
    expect(topReps('maks')).toBeUndefined();
  });

  it('adds 2.5 kg on a barbell lift when every set reached the top last time', () => {
    const [last] = exerciseHistory(days, 'Barbell Bench Press', MON, 1);
    expect(readyToAdd(last, '6-8')).toBe(true);
    expect(setHint('Barbell Bench Press', '6-8', last, 0)).toEqual({ kg: 60, reps: 8 });
    // Not every set at 8 → same weight.
    const [older] = exerciseHistory(days, 'Barbell Bench Press', '2026-10-12', 1);
    expect(setHint('Barbell Bench Press', '6-8', older, 1)).toEqual({ kg: 55, reps: 8 });
    // Dumbbells: no automatic jump, the hint keeps last weight.
    expect(setHint('Dumbbell Curl', '6-8', last, 0).kg).toBe(57.5);
    // A set beyond last time's count copies its last set; first time has no kg.
    expect(setHint('Barbell Bench Press', '6-8', older, 5).kg).toBe(55);
    expect(setHint('Pull-up', 'maks', undefined, 0)).toEqual({ kg: undefined, reps: undefined });
    // Today's earlier set sets the working weight for the next ones.
    expect(setHint('Barbell Bench Press', '6-8', undefined, 1, [done(40, 8), {}]).kg).toBe(40);
    expect(setHint('Barbell Bench Press', '6-8', last, 2, [done(57.5, 8), {}, {}]).kg).toBe(57.5);
    expect(setHint('Barbell Bench Press', '6-8', last, 0, [{}, {}]).kg).toBe(60);
  });
});

describe('rest timer notification', () => {
  it('is one cue at the end of the rest, dropped once long past', () => {
    const r = { endsAt: 1_000_000, totalSec: 90, label: 'Barbell Row (yatık) · 2. set' };
    const ev = restEvents(r, 1_000_000 - 90_000);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: 'cue', at: 1_000_000, itemKey: 'rest', title: 'Dinlenme bitti' });
    expect(ev[0].body).toContain('Barbell Row');
    expect(restEvents(r, 1_000_000 + 60_000)).toEqual([]);
    expect(restEvents(null, 0)).toEqual([]);
  });
});

describe('body log views', () => {
  const days: Record<string, DayDoc> = {
    '2026-07-14': day('2026-07-14', { body: { kg: 110.8 } }),
    [MON]: day(MON, { body: { kg: 104.5, protein: 135, water: 3 } }),
    '2026-10-20': day('2026-10-20', { body: { protein: 110, water: 2.5 } }),
    '2026-10-21': day('2026-10-21', {
      workout: { name: 'Upper A', exercises: [{ name: 'x', reps: '8', restSec: 60, sets: [done(20, 8), {}] }] },
    }),
  };

  it('lists weigh-ins with the change since the last one', () => {
    expect(weighIns(days)).toEqual([
      { date: MON, kg: 104.5, diff: -6.3 },
      { date: '2026-07-14', kg: 110.8 },
    ]);
    expect(lastWeight(days, MON2)).toBe(104.5);
    expect(lastWeight(days, MON)).toBe(110.8);
  });

  it('averages protein and water over logged days', () => {
    expect(intake(days, '2026-10-21', 7)).toMatchObject({ protein: 123, proteinHit: 1, proteinDays: 2, water: 2.8, waterHit: 1 });
  });

  it('lists workouts with at least one set done', () => {
    expect(recentWorkouts(days)).toEqual([{ date: '2026-10-21', name: 'Upper A', done: 1, total: 2, volume: 160 }]);
  });
});

describe('storage keeps the logs', () => {
  it('cleanDay keeps a valid workout and body log and drops junk', async () => {
    const mem = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() {
        return mem.size;
      },
    };
    vi.resetModules();
    const { cleanDay } = await import('../store/store');
    const raw = {
      ...emptyDay(MON),
      workout: {
        name: 'Upper A',
        exercises: [
          { name: 'Barbell Bench Press', reps: '6-8', restSec: 120, sets: [{ kg: 60, reps: 8, done: true }, { kg: 'x' }, 7] },
          { reps: '8' },
        ],
      },
      body: { kg: 104.5, protein: -5, water: 3 },
    };
    const d = cleanDay(MON, JSON.parse(JSON.stringify(raw)))!;
    expect(d.workout).toEqual({
      name: 'Upper A',
      exercises: [{ name: 'Barbell Bench Press', reps: '6-8', restSec: 120, sets: [{ kg: 60, reps: 8, done: true }, {}] }],
    });
    expect(d.body).toEqual({ kg: 104.5, water: 3 });
    expect(cleanDay(MON, { ...emptyDay(MON), workout: 'nope', body: {} })).not.toHaveProperty('workout');
  });
});
