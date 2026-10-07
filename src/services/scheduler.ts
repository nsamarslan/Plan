import { App } from '@capacitor/app';
import { dateKey } from '../lib/time';
import { buildEvents, buildFocusWindows, type FocusWindow, type NotifyEvent, type PlanInput } from '../model/notify';
import { finishItem, resolveDay, skipItem, startItem } from '../model/schedule';
import { isNative, PlanNative, type NativeAction } from '../native/plan';
import { getState, getDay, subscribe, updateDay } from '../store/store';
import { toast } from './toast';

const DAYS_AHEAD = 7;

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
  const s = getState();
  const items = resolveDay(date, s.template, s.types, getDay(date));
  updateDay(date, (d) => {
    if (a.type === 'start') return startItem(d, items, id, a.at);
    if (a.type === 'skip') return skipItem(d, id);
    if (a.type === 'done') return finishItem(d, id, a.at);
    return d;
  });
}

async function consumeNative() {
  if (!isNative) return;
  try {
    const { actions } = await PlanNative.consumeActions();
    actions.forEach(applyNativeAction);
  } catch (e) {
    console.warn('consumeActions failed', e);
  }
}

export function startScheduler() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void push(), 600);
  };
  subscribe(soon);
  void consumeNative().then(push);
  // Re-plan every minute so events roll forward past midnight.
  setInterval(() => void push(), 60_000);
  if (!isNative) setInterval(fireWebEvents, 5_000);
  if (isNative) {
    void App.addListener('resume', () => void consumeNative().then(push));
  }
}
