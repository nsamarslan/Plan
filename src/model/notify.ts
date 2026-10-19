import { addDays, fmt, fmtDuration, msAt, MIN_MS, weekday, type DateKey } from '../lib/time';
import { isOffDay, pomodoroLengths, pomodoroPhases, resolveDay, workMinutes } from './schedule';
import { weekSummary } from './stats';
import type { ArtKey, BlockType, DayDoc, ResolvedItem, Settings, TemplateItem } from './types';

export type NotifyKind = 'pre' | 'start' | 'remind' | 'cue' | 'end';

/** One notification at an absolute time. The Android side schedules these
 *  with exact alarms; the web side fires them while the tab is open. */
export interface NotifyEvent {
  id: string;
  at: number;
  kind: NotifyKind;
  itemKey: string;
  title: string;
  body: string;
  color: string;
  art: ArtKey;
  fullScreen: boolean;
  /** Tapping opens this tab instead of "Şimdi". */
  open?: 'stats';
}

/** A period in which notifications are silenced (calls still ring) and/or
 *  other apps are locked. */
export interface FocusWindow {
  start: number;
  end: number;
  label: string;
  color: string;
  art: ArtKey;
  silence: boolean;
  lock: boolean;
  allowed: string[];
  itemKey?: string;
}

export const itemKey = (date: DateKey, id: string) => `${date}|${id}`;

/**
 * Where each block sits, for the phone to shift the plan by itself when
 * "+10 dk" is tapped on a notification while the app is closed (the app
 * redoes the same shift with the real model when it opens).
 */
export interface PlanSlot {
  itemKey: string;
  start: number;
  end: number;
  /** Waiting to start: later shifts may move it. */
  open: boolean;
  /** Running (not paused): a snooze of the block after it extends this one. */
  active: boolean;
  /** Sends notifications (its "Şimdi" notice makes the previous block's end notice redundant). */
  notify: boolean;
}

export interface PlanInput {
  today: DateKey;
  nowMs: number;
  days: number;
  template: TemplateItem[];
  types: Record<string, BlockType>;
  dayDocs: Record<string, DayDoc>;
  settings: Settings;
}

function nextAfter(items: ResolvedItem[], it: ResolvedItem): ResolvedItem | undefined {
  return items.find((o) => o !== it && o.start >= it.end - 1 && o.log.status === 'pending');
}

export function buildEvents(input: PlanInput): NotifyEvent[] {
  const { today, nowMs, days, template, types, dayDocs, settings } = input;
  const out: NotifyEvent[] = [];

  // Start at yesterday: a block running past midnight still has cues and an end.
  for (let d = -1; d < days; d++) {
    const date = addDays(today, d);
    // A day off stays quiet.
    if (isOffDay(dayDocs[date])) continue;
    const items = resolveDay(date, template, types, dayDocs[date]);
    for (const it of items) {
      if (!it.type.notify) continue;
      const st = it.log.status;
      if (st === 'done' || st === 'skipped') continue;
      const key = itemKey(date, it.id);
      const startMs = msAt(date, it.start);
      const endMs = msAt(date, it.end);
      const base = { itemKey: key, color: it.type.color, art: it.type.art };
      const first = it.type.firstStep;
      const push = (kind: NotifyKind, at: number, title: string, body: string, fullScreen = false, n = 0) =>
        out.push({ id: `${key}|${kind}|${n}`, at, kind, title, body, fullScreen, ...base });

      // Paused: no cues or end while the clock is stopped, just a nudge to come back.
      const pausedAt = st === 'active' ? it.log.pausedAt : undefined;
      if (pausedAt !== undefined) {
        [15, 45].forEach((after, k) =>
          push('cue', pausedAt + after * MIN_MS, `Duraklatıldı: ${it.label}`, `${after} dk oldu. Döndüysen uygulamada "Devam et".`, false, 900 + k),
        );
        continue;
      }
      // Earlier pauses made the block longer; cues follow the work time.
      const workStartMs = startMs + (it.log.pausedMs ?? 0);
      const work = workMinutes(it);

      if (st === 'pending') {
        if (settings.preWarnMin > 0) {
          push('pre', startMs - settings.preWarnMin * MIN_MS, `${settings.preWarnMin} dk sonra: ${it.label}`, `Toparlan. İlk adım: ${first}`);
        }
        push('start', startMs, `Şimdi: ${it.label}`, first, true);
        for (let k = 1; k <= settings.remindCount; k++) {
          const at = startMs + k * settings.remindEveryMin * MIN_MS;
          if (at >= endMs) break; // the block is over; the end notice takes it from here
          push('remind', at, `Hâlâ bekliyor: ${it.label}`, `Tek adım: ${first}`, false, k);
        }
      }

      if (it.type.mode === 'pomodoro') {
        const { focus, brk } = pomodoroLengths(it.type);
        const phases = pomodoroPhases(work, focus, brk);
        const total = phases.filter((p) => p.kind === 'focus').length;
        let focusNo = 1;
        phases.forEach((p, i) => {
          if (i === 0) return;
          const at = workStartMs + p.start * MIN_MS;
          if (p.kind === 'break') {
            push('cue', at, `Mola: ${p.end - p.start} dk`, 'Kalk, su iç, ekrana bakma.', false, i);
          } else {
            focusNo++;
            push('cue', at, `Odak ${focusNo}/${total}: ${it.label}`, `${p.end - p.start} dk. Moladan dön, kaldığın yerden devam.`, false, i);
          }
        });
      } else if (it.type.mode === 'walk' && work >= 20) {
        push('cue', workStartMs + Math.floor(work / 2) * MIN_MS, 'Dönüş zamanı', 'Yarıyı geçtin, eve doğru dön.', false, 1);
      }

      const nxt = nextAfter(items, it);
      // When the next block starts right away its own "Şimdi" notification
      // already says everything; skip the separate end notice.
      if (!nxt || nxt.start - it.end > 2 || !nxt.type.notify) {
        const body = nxt ? `Sırada: ${fmt(nxt.start)} ${nxt.label}` : 'Günün bu kısmı tamam.';
        push('end', endMs, `${it.label} bitti`, body);
      }
    }
  }

  // Android only knows the days we send. If the app isn't opened for that long,
  // say so before the plan runs out instead of going silent.
  if (days > 3) {
    out.push({
      id: 'refresh|plan',
      at: msAt(addDays(today, days - 2), 20 * 60),
      kind: 'cue',
      itemKey: 'refresh|plan',
      title: 'Planı yenile',
      body: 'Plan 2 gün sonra bitiyor. Uygulamayı bir kez aç, yeni günler eklensin.',
      color: '#64748b',
      art: 'review',
      fullScreen: false,
    });
  }

  const weekly = weeklySummaryEvent(input);
  if (weekly) out.push(weekly);

  return out.filter((e) => e.at > nowMs - 30_000).sort((a, b) => a.at - b.at);
}

/**
 * Sunday evening: how this week went and the block let go most often. On a
 * Sunday off it waits until Monday morning. The numbers are as of the last
 * time the app was open (the phone can't work them out by itself).
 */
export function weeklySummaryEvent(input: PlanInput): NotifyEvent | null {
  const { today, nowMs, template, types, dayDocs, settings } = input;
  if (!settings.weeklySummary) return null;
  // Days before the first record don't count (the app wasn't used yet).
  const since = Object.keys(dayDocs).sort()[0];
  const upcoming = addDays(today, (7 - weekday(today)) % 7);
  // Last week's too: its Monday-morning delivery may still be ahead.
  for (const sunday of [addDays(upcoming, -7), upcoming]) {
    const monday = addDays(sunday, -6);
    const late = isOffDay(dayDocs[sunday]);
    const at = late ? msAt(addDays(sunday, 1), settings.wake) : msAt(sunday, settings.weeklySummaryAt);
    if (at <= nowMs) continue;
    const asOf = Math.min(nowMs, at);
    const w = weekSummary({ monday, nowMs: asOf, template, types, dayDocs, since });
    if (!w.judged) continue;
    const prev = weekSummary({ monday: addDays(monday, -7), nowMs: asOf, template, types, dayDocs, since });
    const parts = [`${w.done}/${w.judged} blok · ${fmtDuration(w.doneMin)}`];
    if (w.worst) parts.push(`En çok kaçan: ${w.worst.type.name} (${w.worst.missed})`);
    if (prev.judged) parts.push(`Geçen hafta %${prev.pct}`);
    if (w.offDays) parts.push(`${w.offDays} gün off`);
    return {
      id: `weekly|${sunday}`,
      itemKey: `weekly|${sunday}`,
      at,
      kind: 'cue',
      title: `${late ? 'Geçen hafta' : 'Bu hafta'}: %${w.pct} uyum`,
      body: parts.join(' · '),
      color: '#60a5fa',
      art: 'review',
      fullScreen: false,
      open: 'stats',
    };
  }
  return null;
}

export function buildSlots(input: PlanInput): PlanSlot[] {
  const { today, days, template, types, dayDocs } = input;
  const out: PlanSlot[] = [];
  for (let d = -1; d < days; d++) {
    const date = addDays(today, d);
    if (isOffDay(dayDocs[date])) continue;
    for (const it of resolveDay(date, template, types, dayDocs[date])) {
      out.push({
        itemKey: itemKey(date, it.id),
        start: msAt(date, it.start),
        end: msAt(date, it.end),
        open: it.log.status === 'pending',
        active: it.log.status === 'active' && it.log.pausedAt === undefined,
        notify: it.type.notify,
      });
    }
  }
  return out;
}

export function buildFocusWindows(input: PlanInput): FocusWindow[] {
  const { today, nowMs, days, template, types, dayDocs, settings } = input;
  const out: FocusWindow[] = [];

  for (let d = -1; d < days; d++) {
    const date = addDays(today, d);
    const off = isOffDay(dayDocs[date]);
    if (!off) {
      // Yesterday too: a block running past midnight keeps its focus window.
      const items = resolveDay(date, template, types, dayDocs[date]);
      for (const it of items) {
        if (!it.dnd) continue;
        const st = it.log.status;
        if (st === 'done' || st === 'skipped') continue;
        // Paused for an interruption: the phone is free until "Devam et".
        if (st === 'active' && it.log.pausedAt !== undefined) continue;
        out.push({
          start: msAt(date, it.start),
          end: msAt(date, it.end),
          label: it.label,
          color: it.type.color,
          art: it.type.art,
          silence: true,
          lock: settings.lockAppsInDndBlocks,
          allowed: [...settings.allowedApps, ...it.type.allowedApps],
          itemKey: itemKey(date, it.id),
        });
      }
    }
    // Ranges may cross midnight, so yesterday's range can still be running.
    // On a day off they may still silence the phone, but never lock it.
    const wd = weekday(date);
    for (const r of settings.dndRanges) {
      const lock = r.lockApps && !off;
      if (!r.enabled || !r.days.includes(wd) || (!r.silence && !lock)) continue;
      const endDate = r.end <= r.start ? addDays(date, 1) : date;
      out.push({
        start: msAt(date, r.start),
        end: msAt(endDate, r.end),
        label: r.label,
        color: '#6366f1',
        art: r.end <= r.start ? 'sleep' : 'free',
        silence: r.silence,
        lock,
        allowed: [...settings.allowedApps],
      });
    }
  }

  return out.filter((w) => w.end > nowMs && w.end > w.start).sort((a, b) => a.start - b.start);
}

/** Windows covering `nowMs`, merged into one effective state. */
export function activeFocus(windows: FocusWindow[], nowMs: number): FocusWindow | undefined {
  const act = windows.filter((w) => w.start <= nowMs && nowMs < w.end);
  if (!act.length) return undefined;
  const block = act.find((w) => w.itemKey) ?? act[0];
  return {
    start: Math.min(...act.map((w) => w.start)),
    end: Math.max(...act.map((w) => w.end)),
    label: block.label,
    color: block.color,
    art: block.art,
    silence: act.some((w) => w.silence),
    lock: act.some((w) => w.lock),
    allowed: [...new Set(act.flatMap((w) => w.allowed))],
    itemKey: block.itemKey,
  };
}
