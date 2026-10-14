import { describe, expect, it } from 'vitest';
import { addDays, fmt, msAt, MIN_MS } from '../lib/time';
import { DEFAULT_TYPES, defaultSettings, defaultTemplate } from './defaults';
import { buildEvents, buildFocusWindows, weeklySummaryEvent, type PlanInput } from './notify';
import { quickEvents, quickState, quickWindows, type QuickSession } from './quick';
import {
  effectiveStatus,
  emptyDay,
  extendItem,
  finishItem,
  nowStateAround,
  PAUSE_LIMIT_MIN,
  pauseItem,
  pomodoroAt,
  resolveDay,
  resumeItem,
  skipItem,
  snoozeItem,
  startItem,
} from './schedule';
import { dayStats, rangeStats, streak, weekSummary } from './stats';
import type { DayDoc, Settings } from './types';

const types = Object.fromEntries(DEFAULT_TYPES.map((t) => [t.id, t]));
const tpl = defaultTemplate();
const MON = '2026-10-05';
const SUN = '2026-10-11';
const at = (date: string, h: number, m = 0, s = 0) => msAt(date, h * 60 + m) + s * 1000;
const day = (date: string, patch: Partial<DayDoc> = {}): DayDoc => ({ ...emptyDay(date), ...patch });
const items = (d: DayDoc) => resolveDay(d.date, tpl, types, d);
const byId = (d: DayDoc, id: string) => items(d).find((i) => i.id === id)!;
const input = (today: string, nowMs: number, dayDocs: Record<string, DayDoc>, settings: Settings = defaultSettings()): PlanInput => ({
  today,
  nowMs,
  days: 2,
  template: tpl,
  types,
  dayDocs,
  settings,
});

describe('off day', () => {
  const off = { [MON]: day(MON, { mode: 'off' }) };

  it('sends nothing and locks nothing', () => {
    const ev = buildEvents(input(MON, at(MON, 6), off));
    expect(ev.filter((e) => e.itemKey.startsWith(MON))).toEqual([]);
    const w = buildFocusWindows(input(MON, at(MON, 6), off));
    expect(w.some((x) => x.itemKey?.startsWith(MON))).toBe(false);
    // The night range of the day off may still silence the phone, never lock it.
    const night = w.find((x) => x.start === at(MON, 22, 30))!;
    expect(night.silence).toBe(true);
    expect(night.lock).toBe(false);
    // The next (normal) day is untouched.
    expect(ev.some((e) => e.itemKey.startsWith('2026-10-06'))).toBe(true);
  });

  it('has nothing on the Şimdi screen', () => {
    const st = nowStateAround(MON, tpl, types, off, at(MON, 10));
    expect(st.current).toBeUndefined();
    expect(st.next).toBeUndefined();
  });

  it('is left out of stats and does not break the streak', () => {
    const done = (date: string) => {
      const d = day(date);
      return { ...d, logs: Object.fromEntries(items(d).map((i) => [i.id, { status: 'done' as const }])) };
    };
    const docs = { '2026-10-03': done('2026-10-03'), '2026-10-04': day('2026-10-04', { mode: 'off' }), [MON]: done(MON) };
    const r = rangeStats({ end: MON, days: 3, nowMs: at('2026-10-06', 0), template: tpl, types, dayDocs: docs });
    expect(r.days[1]).toMatchObject({ off: true, planned: 0, missed: 0 });
    expect(streak(r.days)).toBe(2);
    expect(dayStats(MON, items(docs[MON]), at(MON, 23), true).planned).toBe(0);
  });
});

describe('+10 dk', () => {
  it('snoozes a block from the later of its start and the tap, pushing what follows', () => {
    const d = day(MON);
    const next = snoozeItem(d, items(d), 't6', at(MON, 11, 16, 30)); // DSA 2, planned 11:15
    const r = items(next);
    expect(fmt(byId(next, 't6').start)).toBe('11:27');
    expect(fmt(r.find((i) => i.id === 't7')!.start)).toBe('12:57');
    expect(fmt(r.find((i) => i.id === 't8')!.start)).toBe('13:42');
    expect(r.find((i) => i.id === 't9')!.moved).toBe(false); // the gap absorbed it
    // Tapped before the start: 10 minutes after the planned start.
    expect(fmt(byId(snoozeItem(d, items(d), 't6', at(MON, 11, 10)), 't6').start)).toBe('11:25');
  });

  it('gives the time to the block still running right before', () => {
    const d = startItem(day(MON), items(day(MON)), 't2', at(MON, 7, 45)); // pelvis 07:45–08:00
    const next = snoozeItem(d, items(d), 't3', at(MON, 8, 0, 20));
    expect(fmt(byId(next, 't2').end)).toBe('08:11');
    expect(fmt(byId(next, 't3').start)).toBe('08:11');
    expect(byId(next, 't3').log.status).toBe('pending');
  });

  it('extends a block from its end (or from now) and counts it as started', () => {
    const d = day(MON);
    const next = extendItem(d, items(d), 't6', at(MON, 12, 50)); // ended 12:45, tapped 12:50
    expect(fmt(byId(next, 't6').end)).toBe('13:00');
    expect(byId(next, 't6').log).toEqual({ status: 'active', startedAt: at(MON, 11, 15) });
    expect(fmt(byId(next, 't7').start)).toBe('13:00');
    const running = startItem(d, items(d), 't5', at(MON, 9, 30));
    expect(fmt(byId(extendItem(running, items(running), 't5', at(MON, 10, 40)), 't5').end)).toBe('11:10');
  });
});

describe('pause / resume', () => {
  const started = () => startItem(day(MON), items(day(MON)), 't5', at(MON, 9, 30)); // DSA 1 pomodoro 09:30–11:00

  it('freezes the timer and frees the phone while paused', () => {
    const p = pauseItem(started(), 't5', at(MON, 9, 50));
    const it5 = byId(p, 't5');
    expect(pomodoroAt(it5, MON, at(MON, 10, 30)).elapsedMin).toBe(20);
    expect(effectiveStatus(it5, MON, at(MON, 11, 30))).toBe('active'); // waits past the planned end
    expect(effectiveStatus(it5, MON, at(MON, 9, 50) + PAUSE_LIMIT_MIN * MIN_MS)).toBe('done');
    const docs = { [MON]: p };
    expect(buildFocusWindows(input(MON, at(MON, 10), docs)).some((w) => w.itemKey === `${MON}|t5`)).toBe(false);
    const ev = buildEvents(input(MON, at(MON, 9, 51), docs)).filter((e) => e.itemKey === `${MON}|t5`);
    expect(ev.map((e) => [e.title, e.at])).toEqual([
      ['Duraklatıldı: DSA 1', at(MON, 10, 5)],
      ['Duraklatıldı: DSA 1', at(MON, 10, 35)],
    ]);
  });

  it('gives the paused minutes back on resume and keeps them out of the work time', () => {
    const p = pauseItem(started(), 't5', at(MON, 9, 50));
    const r = resumeItem(p, items(p), 't5', at(MON, 10, 10, 10)); // 20 min pause
    const it5 = byId(r, 't5');
    expect(fmt(it5.end)).toBe('11:20');
    expect(it5.log.pausedMs).toBe(20 * MIN_MS);
    expect(it5.log.pausedAt).toBeUndefined();
    expect(fmt(byId(r, 't6').start)).toBe('11:20'); // DSA 2 moved along
    // Phases continue where they stopped; cues follow the work time.
    // (the pause is counted in whole minutes, so the extra 10 s count as work)
    expect(pomodoroAt(it5, MON, at(MON, 10, 10, 10)).elapsedMin).toBeCloseTo(20, 0);
    const cue = buildEvents(input(MON, at(MON, 10, 11), { [MON]: r })).find((e) => e.itemKey === `${MON}|t5` && e.title.startsWith('Mola'));
    expect(cue?.at).toBe(at(MON, 10, 40)); // 50 min of work, 20 min later than planned
    // Finished at 11:20: 110 minutes on the clock, 90 of them work.
    const done = finishItem(r, 't5', at(MON, 11, 20));
    expect(dayStats(MON, items(done), at(MON, 23)).doneMin).toBe(90);
  });

  it('finishing during a pause ends the work when the pause began', () => {
    const p = pauseItem(started(), 't5', at(MON, 10));
    const f = finishItem(p, 't5', at(MON, 10, 40));
    expect(byId(f, 't5').log).toMatchObject({ status: 'done', endedAt: at(MON, 10) });
    expect(dayStats(MON, items(f), at(MON, 23)).doneMin).toBe(30);
  });

  it('pauses a standalone pomodoro too', () => {
    const s: QuickSession = { id: 'q', startedAt: at(MON, 10), focus: 25, brk: 5, rounds: 2, label: '', lock: true, pausedAt: at(MON, 10, 10) };
    expect(quickState(s, at(MON, 10, 40)).phaseLeftSec).toBe(15 * 60);
    expect(quickWindows(s, defaultSettings(), at(MON, 10, 20))).toEqual([]);
    expect(quickEvents(s, at(MON, 10, 11)).map((e) => e.at)).toEqual([at(MON, 10, 25), at(MON, 10, 55)]);
  });
});

describe('weekly summary', () => {
  // Monday–Saturday: everything done except the readings.
  const week = () => {
    const docs: Record<string, DayDoc> = {};
    for (let i = 0; i < 6; i++) {
      const date = addDays(MON, i);
      let d = day(date);
      for (const it of items(d)) d = it.typeId === 'reading' ? skipItem(d, it.id) : finishItem(d, it.id, at(date, 23));
      docs[date] = d;
    }
    return docs;
  };

  it('comes on Sunday evening with the week and the block let go most', () => {
    const e = weeklySummaryEvent(input('2026-10-10', at('2026-10-10', 23), week()))!;
    expect(e.at).toBe(at(SUN, 20));
    expect(e.open).toBe('stats');
    const w = weekSummary({ monday: MON, nowMs: at('2026-10-10', 23), template: tpl, types, dayDocs: week() });
    expect(w.worst?.type.id).toBe('reading');
    expect(e.title).toBe(`Bu hafta: %${w.pct} uyum`);
    expect(e.body).toContain('En çok kaçan: Okuma');
  });

  it('waits for Monday morning on a Sunday off, and can be turned off', () => {
    const docs = { ...week(), [SUN]: day(SUN, { mode: 'off' }) };
    const e = weeklySummaryEvent(input(SUN, at(SUN, 21), docs))!;
    expect(e.at).toBe(at('2026-10-12', 7));
    expect(e.title.startsWith('Geçen hafta')).toBe(true);
    expect(weeklySummaryEvent(input(SUN, at(SUN, 10), week(), { ...defaultSettings(), weeklySummary: false }))).toBeNull();
    // Nothing judged yet: no summary.
    expect(weeklySummaryEvent(input(MON, at(MON, 6), {}))).toBeNull();
  });
});
