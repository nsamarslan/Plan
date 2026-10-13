import { addDays, dateKey, DAY_MIN, daysBetween, minutesOfDay, msAt, weekday } from '../lib/time';
export function emptyDay(date) {
    return { date, mode: 'normal', overrides: {}, extras: [], logs: {} };
}
const PENDING = { status: 'pending' };
const validStart = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const validDuration = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 5;
/** Template + this day's overrides → the concrete, time-sorted plan for the day. */
export function resolveDay(date, template, types, day) {
    const doc = day ?? emptyDay(date);
    const wd = weekday(date);
    const minimal = doc.mode === 'minimal';
    const out = [];
    const add = (t, extra) => {
        const type = types[t.typeId];
        if (!type)
            return;
        const ov = doc.overrides[t.id] ?? {};
        if (ov.removed)
            return;
        // Minimal mode hides non-essential items, unless already started/finished today.
        if (minimal && !extra && !t.minimal && !doc.logs[t.id])
            return;
        const baseDuration = minimal && validDuration(t.minimalDuration) ? t.minimalDuration : t.duration;
        const start = validStart(ov.start) ? ov.start : t.start;
        const duration = validDuration(ov.duration) ? ov.duration : baseDuration;
        // Never let one broken record (e.g. a cleared time input) break the whole day.
        if (!validStart(start) || !validDuration(duration))
            return;
        out.push({
            id: t.id,
            typeId: t.typeId,
            type,
            label: t.label || type.name,
            start,
            end: start + duration,
            duration,
            dnd: ov.dnd ?? t.dnd ?? type.dnd,
            log: doc.logs[t.id] ?? PENDING,
            extra,
            moved: ov.start !== undefined || ov.duration !== undefined,
        });
    };
    // A past day keeps the plan it had (`tpl`), so later template edits
    // don't rewrite history.
    for (const t of doc.tpl ?? template)
        if (Array.isArray(t.days) && t.days.includes(wd))
            add(t, false);
    for (const t of doc.extras)
        add(t, true);
    out.sort((a, b) => a.start - b.start || a.end - b.end);
    return out;
}
export function effectiveStatus(item, date, nowMs) {
    const { status } = item.log;
    if (status === 'done')
        return 'done';
    if (status === 'skipped')
        return 'skipped';
    const endMs = msAt(date, item.end);
    if (status === 'active')
        return nowMs >= endMs ? 'done' : 'active';
    if (nowMs >= endMs)
        return 'missed';
    return nowMs >= msAt(date, item.start) ? 'late' : 'upcoming';
}
/** What should be on screen right now. */
export function nowState(items, date, nowMs) {
    let current;
    let currentStatus;
    for (const it of items) {
        const st = effectiveStatus(it, date, nowMs);
        if (st === 'active' || st === 'late') {
            // Prefer a block that was actually started over one merely due.
            if (!current || (st === 'active' && currentStatus !== 'active')) {
                current = it;
                currentStatus = st;
            }
        }
    }
    const next = items.find((it) => it !== current && effectiveStatus(it, date, nowMs) === 'upcoming');
    return { current, currentStatus, next };
}
/** Like nowState, but a block from yesterday that runs past midnight still counts. */
export function nowStateAround(today, template, types, days, nowMs) {
    const items = resolveDay(today, template, types, days[today]);
    const st = nowState(items, today, nowMs);
    if (st.currentStatus === 'active')
        return { ...st, currentDate: today };
    const y = addDays(today, -1);
    const carry = resolveDay(y, template, types, days[y]).filter((i) => i.end > DAY_MIN);
    const prev = nowState(carry, y, nowMs);
    if (prev.current && (!st.current || prev.currentStatus === 'active')) {
        return { current: prev.current, currentStatus: prev.currentStatus, next: st.next, currentDate: y };
    }
    return { ...st, currentDate: today };
}
function setOverride(day, id, patch) {
    return { ...day, overrides: { ...day.overrides, [id]: { ...day.overrides[id], ...patch } } };
}
/**
 * Move one item to `newStart`. Later items that would overlap are pushed
 * forward just enough, until a gap absorbs the shift. Finished items stay put.
 */
export function moveItem(day, items, id, newStart, cascade = true) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0)
        return day;
    const target = items[idx];
    let next = setOverride(day, id, { start: Math.round(newStart) });
    if (!cascade)
        return next;
    const start = Math.round(newStart);
    let prevEnd = start + target.duration;
    const later = items
        .filter((i) => i.id !== id &&
        i.start >= start &&
        i.log.status !== 'done' &&
        i.log.status !== 'skipped' &&
        i.log.status !== 'active')
        .sort((a, b) => a.start - b.start);
    for (const it of later) {
        if (it.start >= prevEnd)
            break;
        next = setOverride(next, it.id, { start: prevEnd });
        prevEnd = prevEnd + it.duration;
    }
    return next;
}
const isOpen = (i) => i.log.status !== 'done' && i.log.status !== 'skipped' && i.log.status !== 'active';
/** Push the open blocks that start at or after `from` (other than `target`) so
 *  none starts before `prevEnd`; stops at the first gap that absorbs the shift. */
function pushAfter(day, items, target, from, prevEnd) {
    let next = day;
    const after = items
        .filter((i) => i.id !== target.id &&
        isOpen(i) &&
        (i.start > from || (i.start === from && (from !== target.start || i.end >= target.end))))
        .sort((a, b) => a.start - b.start);
    for (const it of after) {
        if (it.start >= prevEnd)
            break;
        next = setOverride(next, it.id, { start: prevEnd });
        prevEnd += it.duration;
    }
    return next;
}
/**
 * Snooze / starting now: the block moves to `newStart`. Later: everything
 * planned after it moves along, so it keeps its place in the order. Earlier:
 * blocks it now overlaps move after it (you are doing this one now).
 */
export function postponeItem(day, items, id, newStart) {
    const target = items.find((i) => i.id === id);
    if (!target)
        return day;
    const start = Math.round(newStart);
    return pushAfter(setOverride(day, id, { start }), items, target, Math.min(start, target.start), start + target.duration);
}
/** Longer blocks push the following ones, the same way moving does. */
export function setDuration(day, items, id, duration) {
    const d = Math.max(5, Math.round(duration));
    const target = items.find((i) => i.id === id);
    const next = setOverride(day, id, { duration: d });
    return target ? pushAfter(next, items, target, target.start, target.start + d) : next;
}
function setLog(day, id, log) {
    return { ...day, logs: { ...day.logs, [id]: log } };
}
/** Grace period: starting this late (or this early) keeps the plan as is. */
export const START_GRACE_MIN = 5;
/** "Başladım". Starting more than a few minutes off-plan moves the block to
 *  now and pushes what comes after it. */
export function startItem(day, items, id, nowMs) {
    const it = items.find((i) => i.id === id);
    if (!it)
        return day;
    // Wall-clock minutes (DST-safe); a start after midnight counts past 24:00.
    const now = new Date(nowMs);
    const nowMin = daysBetween(day.date, dateKey(now)) * DAY_MIN + minutesOfDay(now);
    let next = day;
    if (Math.abs(nowMin - it.start) > START_GRACE_MIN) {
        next = postponeItem(day, items, id, Math.floor(nowMin));
    }
    // One thing at a time: a block still running ends when another one starts.
    for (const o of items) {
        if (o.id !== id && o.log.status === 'active')
            next = finishItem(next, o.id, nowMs);
    }
    return setLog(next, id, { status: 'active', startedAt: nowMs });
}
export function finishItem(day, id, nowMs) {
    const prev = day.logs[id];
    return setLog(day, id, { status: 'done', startedAt: prev?.startedAt, endedAt: nowMs });
}
export function skipItem(day, id) {
    return setLog(day, id, { status: 'skipped' });
}
export function resetItem(day, id) {
    const logs = { ...day.logs };
    delete logs[id];
    return { ...day, logs };
}
export function removeItem(day, id) {
    const extra = day.extras.find((e) => e.id === id);
    if (extra)
        return { ...day, extras: day.extras.filter((e) => e.id !== id) };
    return setOverride(day, id, { removed: true });
}
export function addExtra(day, item) {
    return { ...day, extras: [...day.extras, item] };
}
/** Undo every time change for one item on this day. */
export function clearOverride(day, id) {
    const overrides = { ...day.overrides };
    delete overrides[id];
    return { ...day, overrides };
}
export const DEFAULT_FOCUS_MIN = 50;
export const DEFAULT_BREAK_MIN = 10;
/** Focus / break minutes for a block type (defaults 50 / 10). */
export function pomodoroLengths(type) {
    const focus = Number.isFinite(type.focusMin) && type.focusMin >= 5 ? Math.round(type.focusMin) : DEFAULT_FOCUS_MIN;
    const brk = Number.isFinite(type.breakMin) && type.breakMin >= 0 ? Math.round(type.breakMin) : DEFAULT_BREAK_MIN;
    return { focus, brk };
}
/** Pomodoro phases inside a block; the last phase may be shorter. A 0-minute break means one long focus. */
export function pomodoroPhases(duration, focus = DEFAULT_FOCUS_MIN, brk = DEFAULT_BREAK_MIN) {
    const out = [];
    const f = Math.max(5, focus);
    let t = 0;
    while (t < duration) {
        const fEnd = brk > 0 ? Math.min(duration, t + f) : duration;
        out.push({ kind: 'focus', start: t, end: fEnd });
        t = fEnd;
        if (t >= duration)
            break;
        const bEnd = Math.min(duration, t + brk);
        out.push({ kind: 'break', start: t, end: bEnd });
        t = bEnd;
    }
    return out;
}
/** Where a pomodoro block is at `nowMs` (phases are counted from the block's planned start). */
export function pomodoroAt(item, date, nowMs) {
    const { focus, brk } = pomodoroLengths(item.type);
    return phaseStateAt(pomodoroPhases(item.duration, focus, brk), msAt(date, item.start), nowMs);
}
/** Phase state for any run of phases that started at `startMs`. */
export function phaseStateAt(phases, startMs, nowMs) {
    const duration = phases.length ? phases[phases.length - 1].end : 0;
    const elapsedMin = Math.min(duration, Math.max(0, (nowMs - startMs) / 60_000));
    let index = phases.findIndex((p) => elapsedMin >= p.start && elapsedMin < p.end);
    if (index < 0)
        index = phases.length - 1;
    const phase = phases[index];
    return {
        phases,
        index,
        phase,
        focusNo: phases.slice(0, index + 1).filter((p) => p.kind === 'focus').length,
        focusTotal: phases.filter((p) => p.kind === 'focus').length,
        phaseLeftSec: Math.max(0, (phase.end - elapsedMin) * 60),
        phaseTotalSec: (phase.end - phase.start) * 60,
        elapsedMin,
    };
}
export function uid(prefix = 'x') {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
