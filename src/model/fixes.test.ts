import { afterEach, describe, expect, it } from 'vitest';
import { msAt } from '../lib/time';
import { DEFAULT_TYPES, defaultSettings, defaultTemplate } from './defaults';
import { activeFocus, buildEvents, buildFocusWindows } from './notify';
import { emptyDay, nowStateAround, postponeItem, resolveDay, setDuration, startItem } from './schedule';
import type { DayDoc, TemplateItem } from './types';

// Regression tests for bugs found in the external review (B*, new*).

const types = Object.fromEntries(DEFAULT_TYPES.map((t) => [t.id, t]));
const MON = '2026-10-05';
const TUE = '2026-10-06';
const at = (date: string, h: number, m = 0) => msAt(date, h * 60 + m);
const input = (nowMs: number, dayDocs: Record<string, DayDoc> = {}, template = defaultTemplate()) => ({
  today: MON,
  nowMs,
  days: 2,
  template,
  types,
  dayDocs,
  settings: defaultSettings(),
});

describe('B3: a past day keeps its frozen plan', () => {
  it('uses day.tpl instead of the live template', () => {
    const old = defaultTemplate();
    const changed = old.filter((t) => t.typeId !== 'reading');
    const day: DayDoc = { ...emptyDay(MON), tpl: old.filter((t) => t.days.includes(1)) };
    expect(resolveDay(MON, changed, types, day).some((i) => i.typeId === 'reading')).toBe(true);
    expect(resolveDay(MON, changed, types, emptyDay(MON)).some((i) => i.typeId === 'reading')).toBe(false);
  });
});

describe('B11: broken numbers never break a day', () => {
  it('skips items with a null start and ignores a negative minimal duration', () => {
    const tpl = defaultTemplate();
    tpl[0] = { ...tpl[0], start: null as unknown as number };
    tpl[1] = { ...tpl[1], minimal: true, minimalDuration: -30 };
    const items = resolveDay(MON, tpl, types, { ...emptyDay(MON), mode: 'minimal' });
    expect(items.some((i) => i.id === tpl[0].id)).toBe(false);
    expect(items.find((i) => i.id === tpl[1].id)!.duration).toBe(tpl[1].duration);
    expect(items.every((i) => Number.isFinite(i.start) && i.duration >= 5)).toBe(true);
  });
});

describe('B12: no "still waiting" reminder after the block ended', () => {
  it('caps reminders at the block end', () => {
    const tpl: TemplateItem[] = [{ id: 'short', typeId: 'review', start: 9 * 60, duration: 5, days: [1] }];
    const ev = buildEvents({ ...input(at(MON, 8)), template: tpl }).filter((e) => e.itemKey.endsWith('short'));
    const reminds = ev.filter((e) => e.kind === 'remind');
    expect(reminds.length).toBe(1);
    expect(reminds.every((e) => e.at < at(MON, 9, 5))).toBe(true);
  });
});

describe('B5: a block running past midnight', () => {
  const tpl = defaultTemplate();
  const late = (() => {
    const items = resolveDay(MON, tpl, types, undefined);
    const dsa = items.find((i) => i.label === 'DSA 2')!;
    return { dsa, day: startItem(emptyDay(MON), items, dsa.id, at(MON, 23, 50)) };
  })();

  it('stays on the Şimdi screen after midnight', () => {
    const st = nowStateAround(TUE, tpl, types, { [MON]: late.day }, at(TUE, 0, 30));
    expect(st.current?.id).toBe(late.dsa.id);
    expect(st.currentDate).toBe(MON);
    expect(st.currentStatus).toBe('active');
  });

  it('keeps its focus window', () => {
    const w = buildFocusWindows({ ...input(at(TUE, 0, 30), { [MON]: late.day }, tpl), today: TUE });
    expect(activeFocus(w, at(TUE, 0, 30))?.itemKey).toBe(`${MON}|${late.dsa.id}`);
  });
});

describe('B13: starting on time on a DST change day keeps the plan', () => {
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });
  it('works in Europe/Berlin on 2026-03-29', () => {
    process.env.TZ = 'Europe/Berlin';
    const date = '2026-03-29';
    const tpl = defaultTemplate();
    const items = resolveDay(date, tpl, types, undefined);
    const dsa = items.find((i) => i.label === 'DSA 1')!;
    const day = startItem(emptyDay(date), items, dsa.id, msAt(date, 9 * 60 + 30));
    expect(day.overrides[dsa.id]).toBeUndefined();
  });
});

describe('new8: "15 dk sonra" keeps the block in its place', () => {
  it('pushes the block that would otherwise start first', () => {
    const tpl = defaultTemplate();
    const items = resolveDay(MON, tpl, types, undefined);
    const walk = items.find((i) => i.label === 'Sabah Yürüyüşü')!; // 08:00–08:45
    const day = postponeItem(emptyDay(MON), items, walk.id, 8 * 60 + 55);
    const after = resolveDay(MON, tpl, types, day);
    expect(after.find((i) => i.id === walk.id)!.start).toBe(8 * 60 + 55);
    expect(after.find((i) => i.label === 'Kahvaltı')!.start).toBe(9 * 60 + 40);
    const st = nowStateAround(MON, tpl, types, { [MON]: day }, at(MON, 8, 50));
    expect(st.current).toBeUndefined(); // nothing is due before the snoozed walk
    expect(st.next?.id).toBe(walk.id);
  });
});

describe('starting a block early', () => {
  it('moves blocks it now overlaps after it', () => {
    const tpl = defaultTemplate();
    const items = resolveDay(MON, tpl, types, undefined);
    const read = items.find((i) => i.label === 'Okuma 1')!; // 13:30–14:30
    const day = startItem(emptyDay(MON), items, read.id, at(MON, 12, 30)); // lunch 12:45 is in the way
    const after = resolveDay(MON, tpl, types, day);
    expect(after.find((i) => i.id === read.id)!.start).toBe(12 * 60 + 30);
    expect(after.find((i) => i.label === 'Öğle Yemeği')!.start).toBe(13 * 60 + 30);
    expect(after.find((i) => i.typeId === 'design')!.start).toBe(14 * 60 + 45); // gap absorbs it
  });
});

describe('M1: a longer block pushes the next ones', () => {
  it('cascades on duration change', () => {
    const tpl = defaultTemplate();
    const items = resolveDay(MON, tpl, types, undefined);
    const med = items.find((i) => i.typeId === 'meditation')!; // 07:15–07:45, tilt at 07:45
    const day = setDuration(emptyDay(MON), items, med.id, 45);
    const after = resolveDay(MON, tpl, types, day);
    expect(after.find((i) => i.typeId === 'tilt')!.start).toBe(8 * 60);
    for (let i = 1; i < after.length; i++) expect(after[i].start).toBeGreaterThanOrEqual(after[i - 1].end);
  });
});

describe('new13: one block at a time', () => {
  it('starting a block ends the one still running', () => {
    const tpl = defaultTemplate();
    let items = resolveDay(MON, tpl, types, undefined);
    const dsa1 = items.find((i) => i.label === 'DSA 1')!;
    let day = startItem(emptyDay(MON), items, dsa1.id, at(MON, 9, 30));
    items = resolveDay(MON, tpl, types, day);
    const read = items.find((i) => i.label === 'Okuma 1')!;
    day = startItem(day, items, read.id, at(MON, 10, 0));
    expect(day.logs[dsa1.id].status).toBe('done');
    const st = nowStateAround(MON, tpl, types, { [MON]: day }, at(MON, 10, 1));
    expect(st.current?.id).toBe(read.id);
  });
});
