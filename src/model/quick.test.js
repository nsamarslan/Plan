import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from './defaults';
import { quickDuration, quickEvents, quickPhases, quickState, quickWindows } from './quick';
const T0 = Date.parse('2026-10-13T10:00:00+03:00');
const MIN = 60_000;
const session = (patch = {}) => ({
    id: 'q1',
    startedAt: T0,
    focus: 25,
    brk: 5,
    rounds: 4,
    label: '',
    lock: true,
    ...patch,
});
describe('standalone pomodoro', () => {
    it('has no break after the last round', () => {
        expect(quickDuration(session())).toBe(4 * 25 + 3 * 5);
        const p = quickPhases(session());
        expect(p.map((x) => x.kind)).toEqual(['focus', 'break', 'focus', 'break', 'focus', 'break', 'focus']);
        expect(p[p.length - 1].end).toBe(115);
    });
    it('tracks the phase', () => {
        const st = quickState(session(), T0 + 27 * MIN);
        expect(st.phase.kind).toBe('break');
        expect(Math.round(st.phaseLeftSec)).toBe(3 * 60);
        expect(quickState(session(), T0 + 31 * MIN).focusNo).toBe(2);
    });
    it('cues each phase and the end, without buttons', () => {
        const ev = quickEvents(session({ label: 'LeetCode' }), T0);
        expect(ev.map((e) => e.title)).toEqual([
            'Mola: 5 dk',
            'Odak 2/4: LeetCode',
            'Mola: 5 dk',
            'Odak 3/4: LeetCode',
            'Mola: 5 dk',
            'Odak 4/4: LeetCode',
            'LeetCode bitti',
        ]);
        expect(ev.every((e) => e.kind === 'cue')).toBe(true);
        expect(ev[ev.length - 1].at).toBe(T0 + 115 * MIN);
    });
    it('locks only during focus, and only when asked', () => {
        const w = quickWindows(session(), defaultSettings(), T0);
        expect(w.length).toBe(4);
        expect(w[1].start).toBe(T0 + 30 * MIN);
        expect(w[1].end).toBe(T0 + 55 * MIN);
        expect(quickWindows(session({ lock: false }), defaultSettings(), T0)).toEqual([]);
    });
});
describe('quick store', () => {
    beforeEach(() => {
        const mem = new Map();
        globalThis.localStorage = {
            getItem: (k) => mem.get(k) ?? null,
            setItem: (k, v) => void mem.set(k, String(v)),
            removeItem: (k) => void mem.delete(k),
        };
        vi.resetModules();
    });
    it('remembers the last settings and ends a finished session', async () => {
        const q = await import('../store/quick');
        q.startQuick({ focus: 50, brk: 10, rounds: 2, label: 'Okuma', lock: false }, T0);
        expect(q.getQuickSession()?.startedAt).toBe(T0);
        expect(q.expireQuick(T0 + 60 * MIN)).toBe(false);
        expect(q.expireQuick(T0 + 110 * MIN)).toBe(true);
        expect(q.getQuickSession()).toBeNull();
        vi.resetModules();
        const again = await import('../store/quick');
        expect(again.getQuickConfig()).toMatchObject({ focus: 50, brk: 10, rounds: 2, label: 'Okuma', lock: false });
    });
});
