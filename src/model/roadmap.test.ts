import { describe, expect, it } from 'vitest';
import { weekday } from '../lib/time';
import { DEFAULT_TYPES, defaultSettings, defaultTemplate } from './defaults';
import { blockPlan, phaseOf, roadmapBadge, weekOf } from './roadmap';
import { emptyDay, resolveDay } from './schedule';
import type { TemplateItem } from './types';

const types = Object.fromEntries(DEFAULT_TYPES.map((t) => [t.id, t]));
const day = (date: string, template: TemplateItem[] = defaultTemplate()) => resolveDay(date, template, types, undefined);
const label = (date: string, typeId: string) => day(date).find((i) => i.typeId === typeId)?.label;

const H1_MON = '2026-10-19';
const H1_WED = '2026-10-21';
const H1_SAT = '2026-10-24';
const H2_MON = '2026-10-26';
const H2_TUE = '2026-10-27';
const H2_SAT = '2026-10-31';
const H2_SUN = '2026-11-01';
const H3_MON = '2026-11-02';

describe('roadmap weeks and phases', () => {
  it('counts weeks from Monday 19 Oct 2026, 26 weeks long', () => {
    expect(weekday(H1_MON)).toBe(1);
    expect(weekOf('2026-10-18')).toBe(0);
    expect(weekOf(H1_MON)).toBe(1);
    expect(weekOf('2026-10-25')).toBe(1);
    expect(weekOf(H2_MON)).toBe(2);
    expect(weekOf('2027-04-18')).toBe(26);
    expect(weekOf('2027-04-19')).toBe(0);
  });

  it('matches the hub phase dates', () => {
    expect(phaseOf(weekOf('2026-11-15'))?.no).toBe(1);
    expect(phaseOf(weekOf('2026-11-16'))?.no).toBe(2);
    expect(phaseOf(weekOf('2026-12-21'))?.no).toBe(3);
    expect(phaseOf(weekOf('2027-02-01'))?.no).toBe(4);
    expect(phaseOf(weekOf('2027-02-22'))?.no).toBe(5);
    expect(roadmapBadge(H1_MON)).toBe('H1 · Faz 1 Temel');
    expect(roadmapBadge('2026-10-01')).toBe('');
  });

  it('leaves blocks alone outside the roadmap', () => {
    expect(blockPlan('theory', '2026-10-12')).toBeUndefined();
    expect(label('2026-10-12', 'theory')).toBe('Teori');
  });
});

describe('the study day', () => {
  it('runs the same study blocks every day, Sunday included', () => {
    for (const date of [H1_MON, H1_WED, H1_SAT, H2_SUN]) {
      const ids = day(date).map((i) => i.typeId);
      for (const id of ['tilt', 'dsa', 'build', 'meditation', 'nap', 'theory', 'walk', 'reading']) expect(ids).toContain(id);
    }
  });

  it('has weights and the pre-workout snack only Mon/Tue/Thu/Fri', () => {
    const has = (date: string) => day(date).some((i) => i.typeId === 'weights');
    const snack = (date: string) => day(date).some((i) => i.label === 'Ara Öğün');
    expect([H1_MON, H2_TUE, '2026-10-22', '2026-10-23'].every(has)).toBe(true);
    expect([H1_WED, H1_SAT, H2_SUN].some(has)).toBe(false);
    expect(snack(H1_MON)).toBe(true);
    expect(snack(H1_WED)).toBe(false);
  });

  it('never overlaps, eats only 13:00–19:00 and is done before screens off', () => {
    const night = defaultSettings().dndRanges[0];
    for (let d = 19; d <= 25; d++) {
      const items = day(`2026-10-${d}`);
      for (let i = 1; i < items.length; i++) expect(items[i].start).toBeGreaterThanOrEqual(items[i - 1].end);
      for (const m of items.filter((i) => i.typeId === 'meal')) {
        expect(m.start).toBeGreaterThanOrEqual(13 * 60);
        expect(m.end).toBeLessThanOrEqual(19 * 60);
      }
      expect(items[0].start).toBeGreaterThanOrEqual(defaultSettings().wake);
      expect(items[items.length - 1].end).toBeLessThanOrEqual(night.start);
    }
  });

  it('keeps reading and walking apart', () => {
    const items = day(H1_MON);
    const walk = items.find((i) => i.typeId === 'walk')!;
    const read = items.find((i) => i.typeId === 'reading')!;
    expect(walk.duration).toBe(60);
    expect(read.duration).toBe(60);
    expect(read.start - walk.end).toBeGreaterThanOrEqual(30);
  });

  it('bad-day mode keeps the hub minimum: due reviews + 1 h build + basics', () => {
    const items = resolveDay(H1_MON, defaultTemplate(), types, { ...emptyDay(H1_MON), mode: 'minimal' });
    const dur = (id: string) => items.find((i) => i.typeId === id)?.duration;
    expect(dur('dsa')).toBe(60);
    expect(dur('build')).toBe(60);
    expect(dur('walk')).toBe(30);
    expect(items.some((i) => i.typeId === 'theory' || i.typeId === 'weights')).toBe(false);
  });
});

describe('date-aware block titles', () => {
  it('H1 is all Python in the theory block', () => {
    for (const date of [H1_MON, H1_WED, H1_SAT]) expect(label(date, 'theory')).toBe('Python derinliği');
    expect(label(H1_MON, 'build')).toBe('Build · Modül 1-7');
    expect(label(H1_MON, 'dsa')).toBe('Algo');
  });

  it('from H2: SD on Mon/Wed/Fri, Python on Tue/Thu/Sun, Saturday is review + mock', () => {
    expect(label(H2_MON, 'theory')).toBe('System Design');
    expect(label(H2_TUE, 'theory')).toBe('Python derinliği');
    expect(label(H2_SUN, 'theory')).toBe('Python derinliği');
    expect(label(H2_SAT, 'theory')).toBe('Haftalık tekrar');
    expect(label(H2_SAT, 'dsa')).toBe('Algo mock');
    expect(label(H2_SAT, 'build')).toBe('Build · haftayı kapat');
    expect(label(H1_SAT, 'dsa')).toBe('Algo'); // mocks start in H2
  });

  it('follows the later phases', () => {
    expect(label('2026-11-14', 'theory')).toBe('STAR hikayeleri'); // H4 Saturday
    expect(label('2026-12-05', 'theory')).toBe('Haftalık tekrar'); // H7 Saturday
    expect(label('2026-12-12', 'theory')).toBe('SD mock'); // H8 Saturday
    expect(label('2026-11-17', 'build')).toBe('Build · Modül 8-12, 21');
    expect(label('2026-12-22', 'theory')).toBe('System Design'); // phase 3: SD every day
    expect(label('2026-12-28', 'build')).toBe('Build · hafif hafta'); // H11
    expect(label('2027-01-11', 'build')).toBe('AI · LLM API'); // H13
    expect(label('2027-02-02', 'theory')).toBe('Mülakat hazırlığı');
  });

  it('a label typed into the template still wins', () => {
    const tpl: TemplateItem[] = [{ id: 'x', typeId: 'theory', label: 'Kendi konum', start: 14 * 60, duration: 60, days: [1] }];
    expect(day(H1_MON, tpl)[0].label).toBe('Kendi konum');
  });
});

describe('weights block', () => {
  const weights = (date: string) => day(date).find((i) => i.typeId === 'weights')!;

  it('names the workout by weekday', () => {
    expect(weights(H1_MON).label).toBe('Upper A');
    expect(weights(H2_TUE).label).toBe('Lower A');
    expect(weights('2026-10-22').label).toBe('Upper B');
    expect(weights('2026-10-23').label).toBe('Lower B');
  });

  it('drops one set until 1 November, full sets from 2 November', () => {
    const ramp = weights(H1_MON);
    expect(ramp.detail).toContain('Barbell Bench Press 3×6-8');
    expect(ramp.detail).toContain('Pull-up 2×maks');
    expect(ramp.type.firstStep).toContain('Barbell Bench Press 3×6-8');
    expect(weights(H3_MON).detail).toContain('Barbell Bench Press 4×6-8');
    expect(weights('2026-10-30').detail).toContain('Barbell Deadlift 2×5');
  });

  it('does not touch the shared block type', () => {
    weights(H1_MON);
    expect(types.weights.firstStep).not.toContain('Bench');
  });
});
