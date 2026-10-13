import { addDays, fmt, msAt, MIN_MS, weekday } from '../lib/time';
import { pomodoroLengths, pomodoroPhases, resolveDay } from './schedule';
export const itemKey = (date, id) => `${date}|${id}`;
function nextAfter(items, it) {
    return items.find((o) => o !== it && o.start >= it.end - 1 && o.log.status === 'pending');
}
export function buildEvents(input) {
    const { today, nowMs, days, template, types, dayDocs, settings } = input;
    const out = [];
    // Start at yesterday: a block running past midnight still has cues and an end.
    for (let d = -1; d < days; d++) {
        const date = addDays(today, d);
        const items = resolveDay(date, template, types, dayDocs[date]);
        for (const it of items) {
            if (!it.type.notify)
                continue;
            const st = it.log.status;
            if (st === 'done' || st === 'skipped')
                continue;
            const key = itemKey(date, it.id);
            const startMs = msAt(date, it.start);
            const endMs = msAt(date, it.end);
            const base = { itemKey: key, color: it.type.color, art: it.type.art };
            const first = it.type.firstStep;
            const push = (kind, at, title, body, fullScreen = false, n = 0) => out.push({ id: `${key}|${kind}|${n}`, at, kind, title, body, fullScreen, ...base });
            if (st === 'pending') {
                if (settings.preWarnMin > 0) {
                    push('pre', startMs - settings.preWarnMin * MIN_MS, `${settings.preWarnMin} dk sonra: ${it.label}`, `Toparlan. İlk adım: ${first}`);
                }
                push('start', startMs, `Şimdi: ${it.label}`, first, true);
                for (let k = 1; k <= settings.remindCount; k++) {
                    const at = startMs + k * settings.remindEveryMin * MIN_MS;
                    if (at >= endMs)
                        break; // the block is over; the end notice takes it from here
                    push('remind', at, `Hâlâ bekliyor: ${it.label}`, `Tek adım: ${first}`, false, k);
                }
            }
            if (it.type.mode === 'pomodoro') {
                const { focus, brk } = pomodoroLengths(it.type);
                const phases = pomodoroPhases(it.duration, focus, brk);
                const total = phases.filter((p) => p.kind === 'focus').length;
                let focusNo = 1;
                phases.forEach((p, i) => {
                    if (i === 0)
                        return;
                    const at = startMs + p.start * MIN_MS;
                    if (p.kind === 'break') {
                        push('cue', at, `Mola: ${p.end - p.start} dk`, 'Kalk, su iç, ekrana bakma.', false, i);
                    }
                    else {
                        focusNo++;
                        push('cue', at, `Odak ${focusNo}/${total}: ${it.label}`, `${p.end - p.start} dk. Moladan dön, kaldığın yerden devam.`, false, i);
                    }
                });
            }
            else if (it.type.mode === 'walk' && it.duration >= 20) {
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
    return out.filter((e) => e.at > nowMs - 30_000).sort((a, b) => a.at - b.at);
}
export function buildFocusWindows(input) {
    const { today, nowMs, days, template, types, dayDocs, settings } = input;
    const out = [];
    for (let d = -1; d < days; d++) {
        const date = addDays(today, d);
        {
            // Yesterday too: a block running past midnight keeps its focus window.
            const items = resolveDay(date, template, types, dayDocs[date]);
            for (const it of items) {
                if (!it.dnd)
                    continue;
                const st = it.log.status;
                if (st === 'done' || st === 'skipped')
                    continue;
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
            if (!r.enabled || !r.days.includes(wd) || (!r.silence && !r.lockApps))
                continue;
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
export function activeFocus(windows, nowMs) {
    const act = windows.filter((w) => w.start <= nowMs && nowMs < w.end);
    if (!act.length)
        return undefined;
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
