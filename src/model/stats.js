import { addDays, daysBetween } from '../lib/time';
import { effectiveStatus, resolveDay } from './schedule';
function doneMinutes(it) {
    const { startedAt, endedAt } = it.log;
    if (startedAt && endedAt)
        return Math.min(it.duration, Math.max(0, (endedAt - startedAt) / 60_000));
    return it.duration;
}
export function dayStats(date, items, nowMs) {
    const s = { date, planned: 0, done: 0, skipped: 0, missed: 0, plannedMin: 0, doneMin: 0, onTime: 0, open: 0 };
    for (const it of items) {
        if (!it.type.tracked)
            continue;
        s.planned++;
        s.plannedMin += it.duration;
        const st = effectiveStatus(it, date, nowMs);
        if (st === 'done') {
            s.done++;
            s.doneMin += doneMinutes(it);
            if (it.log.startedAt !== undefined)
                s.onTime++;
        }
        else if (st === 'skipped')
            s.skipped++;
        else if (st === 'missed')
            s.missed++;
        else
            s.open++;
    }
    return s;
}
export function pct(n, d) {
    return d ? Math.round((n / d) * 100) : 0;
}
export function rangeStats(input) {
    const { end, days, nowMs, template, types, dayDocs, since } = input;
    const out = [];
    const byType = new Map();
    for (let i = days - 1; i >= 0; i--) {
        const date = addDays(end, -i);
        if (since && daysBetween(since, date) < 0)
            continue;
        const items = resolveDay(date, template, types, dayDocs[date]);
        out.push(dayStats(date, items, nowMs));
        for (const it of items) {
            if (!it.type.tracked)
                continue;
            const t = byType.get(it.typeId) ?? { type: it.type, planned: 0, done: 0, doneMin: 0, plannedMin: 0 };
            t.planned++;
            t.plannedMin += it.duration;
            if (effectiveStatus(it, date, nowMs) === 'done') {
                t.done++;
                t.doneMin += doneMinutes(it);
            }
            byType.set(it.typeId, t);
        }
    }
    return { days: out, byType: [...byType.values()] };
}
/** Consecutive days (ending today or yesterday) with ≥ 80% of blocks done. */
export function streak(days) {
    let n = 0;
    for (let i = days.length - 1; i >= 0; i--) {
        const d = days[i];
        const judged = d.planned - d.open;
        if (i === days.length - 1 && d.open > 0 && pct(d.done, d.planned) < 80)
            continue;
        if (judged === 0 || pct(d.done, d.planned) < 80)
            break;
        n++;
    }
    return n;
}
