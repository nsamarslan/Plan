import { App } from '@capacitor/app';
import { dateKey } from '../lib/time';
import { buildEvents, buildFocusWindows, type FocusWindow, type NotifyEvent, type PlanInput } from '../model/notify';
import { finishItem, resolveDay, skipItem, startItem } from '../model/schedule';
import { isNative, PlanNative, type NativeAction } from '../native/plan';
import { getState, getDay, subscribe, updateDay } from '../store/store';
import { pullNow } from '../store/sync';
import { toast } from './toast';

// Two weeks: the phone keeps notifying even if the app isn't opened for a while.
const DAYS_AHEAD = 14;

export function planInput(nowMs = Date.now()): PlanInput {
  const s = getState();
  return {
    today: dateKey(new Date(nowMs)),
    nowMs,
    days: DAYS_AHEAD,
    template: s.template,
    types: s.types,
    dayDocs: s.days,
    settings: s.settings,
  };
}

let webEvents: NotifyEvent[] = [];
let webWindows: FocusWindow[] = [];
let lastFired = Date.now();
let lastSig = '';

async function push() {
  // Apply notification-button taps first, so a stale plan never overrides them.
  await consumeNative();
  const input = planInput();
  const events = buildEvents(input);
  const windows = buildFocusWindows(input);
  if (isNative) {
    const sig = JSON.stringify([events, windows]);
    if (sig === lastSig) return;
    lastSig = sig;
    try {
      await PlanNative.setSchedule({ events, windows });
    } catch (e) {
      console.warn('setSchedule failed', e);
    }
  } else {
    webEvents = events;
    webWindows = windows;
  }
}

export function webFocusWindows(): FocusWindow[] {
  return webWindows;
}

function fireWebEvents() {
  const now = Date.now();
  const due = webEvents.filter((e) => e.at > lastFired && e.at <= now);
  lastFired = now;
  for (const e of due) {
    toast({ title: e.title, body: e.body, color: e.color });
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(e.title, { body: e.body, tag: e.itemKey, requireInteraction: e.kind === 'start' });
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    }
    if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
  }
}

export function applyNativeAction(a: NativeAction) {
  if (!a.itemKey) return;
  const [date, id] = a.itemKey.split('|');
  if (!date || !id) return;
  const s = getState();
  const items = resolveDay(date, s.template, s.types, getDay(date));
  const it = items.find((i) => i.id === id);
  if (!it) return;
  // A button tapped on an old notification must not undo what was done in the app since.
  const st = it.log.status;
  if (a.type === 'start' && st !== 'pending') return;
  if (a.type === 'skip' && st !== 'pending') return;
  if (a.type === 'done' && (st === 'done' || st === 'skipped')) return;
  updateDay(date, (d) => {
    if (a.type === 'start') return startItem(d, items, id, a.at);
    if (a.type === 'skip') return skipItem(d, id);
    if (a.type === 'done') return finishItem(d, id, a.at);
    return d;
  });
}

let consuming: Promise<void> | null = null;

function consumeNative(): Promise<void> {
  if (!isNative) return Promise.resolve();
  // One at a time: push() and the resume handler can both ask.
  consuming ??= PlanNative.consumeActions()
    .then(({ actions }) => actions.forEach(applyNativeAction))
    .catch((e) => console.warn('consumeActions failed', e))
    .finally(() => {
      consuming = null;
    });
  return consuming;
}

export function startScheduler() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void push(), 600);
  };
  subscribe(soon);
  void push();
  // Re-plan every minute so events roll forward past midnight.
  setInterval(() => void push(), 60_000);
  if (!isNative) setInterval(fireWebEvents, 5_000);
  if (isNative) {
    // Pull the other device's changes before applying notification taps, so a
    // tap on yesterday's copy of a day doesn't overwrite newer edits.
    void App.addListener('resume', () => void pullNow().then(push));
  }
}
