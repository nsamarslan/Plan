import { describe, expect, it } from 'vitest';
import { msAt } from '../lib/time';
import { DEFAULT_TYPES, defaultSettings, defaultTemplate } from './legacy.fixture';
import { buildEvents } from './notify';
import { pomodoroAt, pomodoroLengths, pomodoroPhases, resolveDay } from './schedule';
import type { BlockType } from './types';

const MON = '2026-10-05';
const at = (h: number, m = 0) => msAt(MON, h * 60 + m);
const typesWith = (patch: Partial<BlockType>) =>
  Object.fromEntries(DEFAULT_TYPES.map((t) => [t.id, t.id === 'dsa' ? { ...t, ...patch } : t]));

describe('pomodoro phases', () => {
  it('splits a block by the chosen lengths', () => {
    const p = pomodoroPhases(90, 25, 5).map((x) => [x.kind, x.start, x.end]);
    expect(p).toEqual([
      ['focus', 0, 25],
      ['break', 25, 30],
      ['focus', 30, 55],
      ['break', 55, 60],
      ['focus', 60, 85],
      ['break', 85, 90],
    ]);
    expect(pomodoroPhases(60, 50, 10).map((x) => x.kind)).toEqual(['focus', 'break']);
    expect(pomodoroPhases(90, 50, 0)).toEqual([{ kind: 'focus', start: 0, end: 90 }]);
  });

  it('falls back to 50/10 for missing or broken lengths', () => {
    expect(pomodoroLengths({})).toEqual({ focus: 50, brk: 10 });
    expect(pomodoroLengths({ focusMin: 2, breakMin: -1 })).toEqual({ focus: 50, brk: 10 });
    expect(pomodoroLengths({ focusMin: 25, breakMin: 0 })).toEqual({ focus: 25, brk: 0 });
  });
});

describe('pomodoroAt', () => {
  it('knows the phase and the time left in it', () => {
    const types = typesWith({ focusMin: 25, breakMin: 5 });
    const dsa = resolveDay(MON, defaultTemplate(), types, undefined).find((i) => i.label === 'DSA 1')!; // 09:30–11:00
    const a = pomodoroAt(dsa, MON, at(9, 40));
    expect(a.phase.kind).toBe('focus');
    expect(a.focusNo).toBe(1);
    expect(a.focusTotal).toBe(3);
    expect(Math.round(a.phaseLeftSec)).toBe(15 * 60);
    const b = pomodoroAt(dsa, MON, at(9, 57));
    expect(b.phase.kind).toBe('break');
    expect(Math.round(b.phaseLeftSec)).toBe(3 * 60);
    const c = pomodoroAt(dsa, MON, at(10, 31));
    expect(c.focusNo).toBe(3);
  });
});

describe('pomodoro notifications', () => {
  it('cue at every phase change with the chosen lengths', () => {
    const types = typesWith({ focusMin: 25, breakMin: 5 });
    const tpl = defaultTemplate();
    const dsaId = tpl.find((t) => t.label === 'DSA 1')!.id;
    const cues = buildEvents({ today: MON, nowMs: at(8), days: 1, template: tpl, types, dayDocs: {}, settings: defaultSettings() }).filter(
      (e) => e.itemKey.endsWith(dsaId) && e.kind === 'cue',
    );
    expect(cues.map((e) => e.title)).toEqual(['Mola: 5 dk', 'Odak 2/3: DSA 1', 'Mola: 5 dk', 'Odak 3/3: DSA 1', 'Mola: 5 dk']);
    expect(cues[0].at).toBe(at(9, 55));
  });
});
