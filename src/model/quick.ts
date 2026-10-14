import { MIN_MS } from '../lib/time';
import type { FocusWindow, NotifyEvent } from './notify';
import { phaseStateAt, pomodoroPhases, type PomodoroPhase, type PomodoroState } from './schedule';
import type { Settings } from './types';

// A pomodoro you start on the spot, without picking a block from the plan.

export const QUICK_COLOR = '#f05a3c';

export const POMO_PRESETS = [
  { focus: 25, brk: 5 },
  { focus: 50, brk: 10 },
  { focus: 45, brk: 15 },
];

export interface QuickConfig {
  focus: number;
  brk: number;
  rounds: number;
  label: string;
  /** Silence notifications + lock apps during focus phases (breaks stay free). */
  lock: boolean;
}

export interface QuickSession extends QuickConfig {
  id: string;
  /** Moves forward on "Devam et" by the paused time, so phases keep their length. */
  startedAt: number;
  /** Paused since: the clock is stopped. */
  pausedAt?: number;
}

export const DEFAULT_QUICK: QuickConfig = { focus: 25, brk: 5, rounds: 4, label: '', lock: true };

/** Total minutes: rounds of focus with breaks between them (none after the last). */
export function quickDuration(c: Pick<QuickConfig, 'focus' | 'brk' | 'rounds'>): number {
  return c.rounds * c.focus + Math.max(0, c.rounds - 1) * c.brk;
}

export function quickPhases(c: QuickConfig): PomodoroPhase[] {
  return pomodoroPhases(quickDuration(c), c.focus, c.brk);
}

/** When it ends; while paused, that keeps moving with the clock. */
export function quickEndsAt(s: QuickSession, nowMs = s.pausedAt ?? 0): number {
  const paused = s.pausedAt !== undefined ? Math.max(0, nowMs - s.pausedAt) : 0;
  return s.startedAt + quickDuration(s) * MIN_MS + paused;
}

/** Phase and time left; frozen while paused. */
export function quickState(s: QuickSession, nowMs: number): PomodoroState {
  return phaseStateAt(quickPhases(s), s.startedAt, s.pausedAt ?? nowMs);
}

export const quickLabel = (s: QuickConfig) => s.label.trim() || 'Pomodoro';
export const quickKey = (s: QuickSession) => `quick|${s.id}`;

/** A cue at every phase change and at the end ('cue' kind: no buttons on these). */
export function quickEvents(s: QuickSession, nowMs: number): NotifyEvent[] {
  if (s.pausedAt !== undefined) {
    // Stopped clock: no phase cues, just a nudge to come back.
    const pausedAt = s.pausedAt;
    return [15, 45]
      .map((after) => ({
        id: `${quickKey(s)}|p${after}`,
        itemKey: quickKey(s),
        kind: 'cue' as const,
        at: pausedAt + after * MIN_MS,
        title: `Duraklatıldı: ${quickLabel(s)}`,
        body: `${after} dk oldu. Döndüysen uygulamada "Devam et".`,
        color: QUICK_COLOR,
        art: 'free' as const,
        fullScreen: false,
      }))
      .filter((e) => e.at > nowMs - 30_000);
  }
  const phases = quickPhases(s);
  const total = phases.filter((p) => p.kind === 'focus').length;
  const label = quickLabel(s);
  const key = quickKey(s);
  const out: NotifyEvent[] = [];
  let focusNo = 1;
  phases.forEach((p, i) => {
    if (i === 0) return;
    const base = { itemKey: key, color: QUICK_COLOR, art: 'free' as const, fullScreen: false, kind: 'cue' as const };
    if (p.kind === 'break') {
      out.push({ ...base, id: `${key}|b${i}`, at: s.startedAt + p.start * MIN_MS, title: `Mola: ${p.end - p.start} dk`, body: 'Kalk, su iç, ekrana bakma.' });
    } else {
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
export function quickWindows(s: QuickSession, settings: Settings, nowMs: number): FocusWindow[] {
  if (!s.lock || s.pausedAt !== undefined) return [];
  return quickPhases(s)
    .filter((p) => p.kind === 'focus')
    .map((p) => ({
      start: s.startedAt + p.start * MIN_MS,
      end: s.startedAt + p.end * MIN_MS,
      label: quickLabel(s),
      color: QUICK_COLOR,
      art: 'free' as const,
      silence: true,
      lock: settings.lockAppsInDndBlocks,
      allowed: [...settings.allowedApps],
      itemKey: quickKey(s),
    }))
    .filter((w) => w.end > nowMs);
}
