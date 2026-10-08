import { addDays, fmt, msAt, MIN_MS, weekday, type DateKey } from '../lib/time';
import { pomodoroPhases, resolveDay } from './schedule';
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

  for (let d = 0; d < days; d++) {
    const date = addDays(today, d);
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

      if (st === 'pending') {
        if (settings.preWarnMin > 0) {
          push('pre', startMs - settings.preWarnMin * MIN_MS, `${settings.preWarnMin} dk sonra: ${it.label}`, `Toparlan. İlk adım: ${first}`);
        }
        push('start', startMs, `Şimdi: ${it.label}`, first, true);
        for (let k = 1; k <= settings.remindCount; k++) {
          push('remind', startMs + k * settings.remindEveryMin * MIN_MS, `Hâlâ bekliyor: ${it.label}`, `Tek adım: ${first}`, false, k);
        }
      }

      if (it.type.mode === 'pomodoro') {
        const phases = pomodoroPhases(it.duration);
        phases.forEach((p, i) => {
          if (i === 0) return;
          const at = startMs + p.start * MIN_MS;
          if (p.kind === 'break') push('cue', at, `Mola: ${p.end - p.start} dk`, 'Kalk, su iç, ekrana bakma.', false, i);
          else push('cue', at, `Odak: ${it.label}`, 'Moladan dön, kaldığın yerden devam.', false, i);
        });
      } else if (it.type.mode === 'walk' && it.duration >= 20) {
        push('cue', startMs + Math.floor(it.duration / 2) * MIN_MS, 'Dönüş zamanı', 'Yarıyı geçtin, eve doğru dön.', false, 1);
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

  return out.filter((e) => e.at > nowMs - 30_000).sort((a, b) => a.at - b.at);
}

export function buildFocusWindows(input: PlanInput): FocusWindow[] {
  const { today, nowMs, days, template, types, dayDocs, settings } = input;
  const out: FocusWindow[] = [];

  for (let d = -1; d < days; d++) {
    const date = addDays(today, d);
    if (d >= 0) {
      const items = resolveDay(date, template, types, dayDocs[date]);
      for (const it of items) {
        if (!it.dnd) continue;
        const st = it.log.status;
        if (st === 'done' || st === 'skipped') continue;
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
    const wd = weekday(date);
    for (const r of settings.dndRanges) {
      if (!r.enabled || !r.days.includes(wd) || (!r.silence && !r.lockApps)) continue;
      const endDate = r.end <= r.start ? addDays(date, 1) : date;
      out.push({
        start: msAt(date, r.start),
        end: msAt(endDate, r.end),
        label: r.label,
        color: '#6366f1',
        art: r.end <= r.start ? 'sleep' : 'free',
        silence: r.silence,
        lock: r.lockApps,
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
