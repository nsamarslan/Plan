import { describe, expect, it } from 'vitest';
import { msAt, MIN_MS } from '../lib/time';
import { DEFAULT_TYPES, defaultSettings, defaultTemplate } from './defaults';
import {
  emptyDay,
  finishItem,
  moveItem,
  nowState,
  pomodoroPhases,
  resolveDay,
  skipItem,
  startItem,
} from './schedule';
import { activeFocus, buildEvents, buildFocusWindows } from './notify';
import { dayStats, streak } from './stats';
import { phaseFor, programDay, routineFor } from './tilt';

const types = Object.fromEntries(DEFAULT_TYPES.map((t) => [t.id, t]));
const MON = '2026-10-05';
const WED = '2026-10-07';
const at = (date: string, h: number, m = 0) => msAt(date, h * 60 + m);

describe('resolveDay', () => {
  it('includes weights only on its weekdays', () => {
    const tpl = defaultTemplate();
    expect(resolveDay(MON, tpl, types, undefined).some((i) => i.typeId === 'weights')).toBe(true);
    expect(resolveDay(WED, tpl, types, undefined).some((i) => i.typeId === 'weights')).toBe(false);
  });

  it('applies the requested daily totals', () => {
    const items = resolveDay(MON, defaultTemplate(), types, undefined);
    const total = (id: string) => items.filter((i) => i.typeId === id).reduce((s, i) => s + i.duration, 0);
    expect(total('tilt')).toBe(15);
    expect(total('walk')).toBe(90);
    expect(total('weights')).toBe(45);
    expect(total('reading')).toBe(120);
    expect(total('meditation')).toBe(30);
    expect(total('dsa')).toBe(180);
    expect(total('design')).toBe(60);
    expect(total('ai')).toBe(60);
    for (let i = 1; i < items.length; i++) expect(items[i].start).toBeGreaterThanOrEqual(items[i - 1].end);
  });

  it('minimal mode keeps essentials with shorter durations', () => {
    const day = { ...emptyDay(MON), mode: 'minimal' as const };
    const items = resolveDay(MON, defaultTemplate(), types, day);
    expect(items.map((i) => i.typeId).filter((t) => t !== 'meal')).toEqual(['tilt', 'walk', 'dsa', 'review']);
    expect(items.find((i) => i.typeId === 'dsa')!.duration).toBe(60);
  });
});

describe('start / move', () => {
  it('starting on time keeps the plan', () => {
    const tpl = defaultTemplate();
    const items = resolveDay(MON, tpl, types, undefined);
    const dsa = items.find((i) => i.label === 'DSA 1')!;
    const day = startItem(emptyDay(MON), items, dsa.id, at(MON, 9, 33));
    expect(day.overrides[dsa.id]).toBeUndefined();
    expect(day.logs[dsa.id].status).toBe('active');
  });

  it('starting late moves the block and pushes overlapping ones until a gap absorbs it', () => {
    const tpl = defaultTemplate();
    const items = resolveDay(MON, tpl, types, undefined);
    const dsa1 = items.find((i) => i.label === 'DSA 1')!;
    const day = startItem(emptyDay(MON), items, dsa1.id, at(MON, 10, 0));
    const after = resolveDay(MON, tpl, types, day);
    const get = (label: string) => after.find((i) => i.label === label)!;
    expect(get('DSA 1').start).toBe(10 * 60);
    expect(get('DSA 2').start).toBe(11 * 60 + 30); // pushed from 11:15
    expect(get('Öğle Yemeği').start).toBe(13 * 60); // pushed from 12:45
    expect(get('Okuma 1').start).toBe(13 * 60 + 45); // pushed from 13:30
    expect(get('System Design').start).toBe(14 * 60 + 45); // gap absorbed
  });

  it('moving an item later does not drag items that come before its new slot', () => {
    const tpl = defaultTemplate();
    const items = resolveDay(MON, tpl, types, undefined);
    const read = items.find((i) => i.label === 'Okuma 1')!;
    const day = moveItem(emptyDay(MON), items, read.id, 16 * 60 + 30);
    const after = resolveDay(MON, tpl, types, day);
    expect(after.find((i) => i.typeId === 'design')!.start).toBe(14 * 60 + 45);
    expect(after.find((i) => i.typeId === 'ai')!.start).toBe(16 * 60);
    expect(after.find((i) => i.label === 'Okuma 1')!.start).toBe(16 * 60 + 30);
    expect(after.find((i) => i.typeId === 'weights')!.start).toBe(17 * 60 + 30);
  });
});

describe('nowState', () => {
  it('shows the due block, then the next one after finishing', () => {
    const tpl = defaultTemplate();
    let day = emptyDay(MON);
    let items = resolveDay(MON, tpl, types, day);
    const s1 = nowState(items, MON, at(MON, 9, 40));
    expect(s1.current?.label).toBe('DSA 1');
    expect(s1.currentStatus).toBe('late');
    day = finishItem(day, s1.current!.id, at(MON, 10, 0));
    items = resolveDay(MON, tpl, types, day);
    const s2 = nowState(items, MON, at(MON, 10, 1));
    expect(s2.current).toBeUndefined();
    expect(s2.next?.label).toBe('DSA 2');
  });
});

describe('notifications', () => {
  it('builds pre/start/remind/cue/end events and skips finished items', () => {
    const settings = defaultSettings();
    const tpl = defaultTemplate();
    const input = { today: MON, nowMs: at(MON, 9, 0), days: 1, template: tpl, types, dayDocs: {}, settings };
    const ev = buildEvents(input);
    const dsa1 = ev.filter((e) => e.title.includes('DSA 1') || e.itemKey.endsWith(tpl[4].id));
    expect(dsa1.map((e) => e.kind)).toEqual(['pre', 'start', 'remind', 'remind', 'remind', 'cue', 'cue', 'end']);
    expect(ev.every((e) => e.at > input.nowMs - 30_000)).toBe(true);

    const items = resolveDay(MON, tpl, types, undefined);
    const day = skipItem(emptyDay(MON), items.find((i) => i.label === 'DSA 1')!.id);
    const ev2 = buildEvents({ ...input, dayDocs: { [MON]: day } });
    expect(ev2.some((e) => e.itemKey.endsWith(tpl[4].id))).toBe(false);
  });

  it('pomodoro phases', () => {
    expect(pomodoroPhases(90).map((p) => [p.kind, p.start, p.end])).toEqual([
      ['focus', 0, 50],
      ['break', 50, 60],
      ['focus', 60, 90],
    ]);
    expect(pomodoroPhases(60).length).toBe(2);
  });
});

describe('focus windows', () => {
  it('night range crosses midnight and blocks with dnd lock apps', () => {
    const settings = defaultSettings();
    const input = { today: MON, nowMs: at(MON, 3, 0), days: 2, template: defaultTemplate(), types, dayDocs: {}, settings };
    const w = buildFocusWindows(input);
    const night = activeFocus(w, at(MON, 3, 0));
    expect(night?.label).toBe('Gece');
    expect(night?.silence).toBe(true);
    const dsa = activeFocus(w, at(MON, 10, 0));
    expect(dsa?.label).toBe('DSA 1');
    expect(dsa?.lock).toBe(true);
    expect(activeFocus(w, at(MON, 8, 10))).toBeUndefined(); // walking: no lock
    expect(w.every((x) => x.end > x.start)).toBe(true);
    expect(at(MON, 23, 0) + 8 * 60 * MIN_MS).toBeGreaterThan(at(MON, 23, 0));
  });
});

describe('stats', () => {
  it('counts done / missed and auto-completes started blocks at their end', () => {
    const tpl = defaultTemplate();
    let day = emptyDay(MON);
    let items = resolveDay(MON, tpl, types, day);
    day = startItem(day, items, items[0].id, at(MON, 7, 15)); // meditation started, never "finished"
    day = skipItem(day, items[1].id);
    items = resolveDay(MON, tpl, types, day);
    const s = dayStats(MON, items, at(MON, 9, 0));
    expect(s.done).toBe(1);
    expect(s.skipped).toBe(1);
    expect(s.missed).toBe(1); // morning walk not started
    expect(streak([{ ...s, planned: 5, done: 5, open: 0 }])).toBe(1);
  });
});

describe('tilt program', () => {
  it('follows the phases', () => {
    expect(programDay('2026-10-01', '2026-10-01')).toBe(1);
    expect(phaseFor(1).name).toBe('Pozisyonu bul');
    expect(phaseFor(20).name).toBe('Tekrarı artır');
    expect(phaseFor(30).name).toBe('Yüklen');
    expect(phaseFor(90).name).toBe('Ayağa taşı');
    expect(routineFor(1).map((s) => s.ex.id)).toEqual(['breath', 'flexor', 'bridge', 'deadbug']);
    expect(routineFor(35).some((s) => s.ex.id === 'thrust')).toBe(true);
  });
});
