import { MIN_MS } from '../lib/time';
import { phaseStateAt, pomodoroPhases } from './schedule';
// A pomodoro you start on the spot, without picking a block from the plan.
export const QUICK_COLOR = '#f05a3c';
export const POMO_PRESETS = [
    { focus: 25, brk: 5 },
    { focus: 50, brk: 10 },
    { focus: 45, brk: 15 },
];
export const DEFAULT_QUICK = { focus: 25, brk: 5, rounds: 4, label: '', lock: true };
/** Total minutes: rounds of focus with breaks between them (none after the last). */
export function quickDuration(c) {
    return c.rounds * c.focus + Math.max(0, c.rounds - 1) * c.brk;
}
export function quickPhases(c) {
    return pomodoroPhases(quickDuration(c), c.focus, c.brk);
}
export function quickEndsAt(s) {
    return s.startedAt + quickDuration(s) * MIN_MS;
}
export function quickState(s, nowMs) {
    return phaseStateAt(quickPhases(s), s.startedAt, nowMs);
}
export const quickLabel = (s) => s.label.trim() || 'Pomodoro';
export const quickKey = (s) => `quick|${s.id}`;
/** A cue at every phase change and at the end ('cue' kind: no buttons on these). */
export function quickEvents(s, nowMs) {
    const phases = quickPhases(s);
    const total = phases.filter((p) => p.kind === 'focus').length;
    const label = quickLabel(s);
    const key = quickKey(s);
    const out = [];
    let focusNo = 1;
    phases.forEach((p, i) => {
        if (i === 0)
            return;
        const base = { itemKey: key, color: QUICK_COLOR, art: 'free', fullScreen: false, kind: 'cue' };
        if (p.kind === 'break') {
            out.push({ ...base, id: `${key}|b${i}`, at: s.startedAt + p.start * MIN_MS, title: `Mola: ${p.end - p.start} dk`, body: 'Kalk, su iç, ekrana bakma.' });
        }
        else {
            focusNo++;
            out.push({ ...base, id: `${key}|f${i}`, at: s.startedAt + p.start * MIN_MS, title: `Odak ${focusNo}/${total}: ${label}`, body: `${p.end - p.start} dk. Kaldığın yerden devam.` });
        }
    });
    out.push({
        id: `${key}|end`,
        itemKey: key,
        kind: 'cue',
        at: quickEndsAt(s),
        title: `${label} bitti`,
        body: `${total} tur tamam. Eline sağlık.`,
        color: QUICK_COLOR,
        art: 'free',
        fullScreen: false,
    });
    return out.filter((e) => e.at > nowMs - 30_000);
}
/** Focus mode only while focusing; the phone is free during breaks. */
export function quickWindows(s, settings, nowMs) {
    if (!s.lock)
        return [];
    return quickPhases(s)
        .filter((p) => p.kind === 'focus')
        .map((p) => ({
        start: s.startedAt + p.start * MIN_MS,
        end: s.startedAt + p.end * MIN_MS,
        label: quickLabel(s),
        color: QUICK_COLOR,
        art: 'free',
        silence: true,
        lock: settings.lockAppsInDndBlocks,
        allowed: [...settings.allowedApps],
        itemKey: quickKey(s),
    }))
        .filter((w) => w.end > nowMs);
}
