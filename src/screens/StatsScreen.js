import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { cssVars, Segmented } from '../components/ui';
import { addDays, dateKey, daysBetween, fmtDateLong, fmtDuration, weekday, WEEKDAYS_SHORT } from '../lib/time';
import { effectiveStatus, resolveDay } from '../model/schedule';
import { pct, rangeStats, streak } from '../model/stats';
import { phaseFor, PROGRAM_DAYS, programDay } from '../model/tilt';
import { firstDay, useAppState } from '../store/store';
const BAR = '#60a5fa';
export function StatsScreen({ now }) {
    const s = useAppState();
    const today = dateKey(new Date(now));
    const [range, setRange] = useState('7');
    const [picked, setPicked] = useState(null);
    const since = firstDay();
    // Recompute once a minute, not on every clock tick.
    const minuteNow = Math.floor(now / 60_000) * 60_000;
    const week = useMemo(() => rangeStats({ end: today, days: 7, nowMs: minuteNow, template: s.template, types: s.types, dayDocs: s.days }), [today, minuteNow, s]);
    const span = useMemo(() => rangeStats({ end: today, days: Number(range), nowMs: minuteNow, template: s.template, types: s.types, dayDocs: s.days, since }), [today, minuteNow, s, range, since]);
    // The streak is not limited by the 7/30-day selector below.
    const streakDays = useMemo(() => s.settings.showStreak
        ? rangeStats({ end: today, days: 366, nowMs: minuteNow, template: s.template, types: s.types, dayDocs: s.days, since }).days
        : [], [today, minuteNow, s, since]);
    const t = week.days[week.days.length - 1];
    const judged = span.days.reduce((a, d) => ({ planned: a.planned + d.planned - d.open, done: a.done + d.done, doneMin: a.doneMin + d.doneMin }), { planned: 0, done: 0, doneMin: 0 });
    const pickedDay = week.days.find((d) => d.date === picked) ?? t;
    // Pelvis program: one dot per program day, filled when the tilt block was done.
    const tiltDay = programDay(s.settings.tiltStartDate, today);
    const tiltDone = useMemo(() => {
        const out = [];
        for (let i = 0; i < PROGRAM_DAYS; i++) {
            const date = addDays(s.settings.tiltStartDate, i);
            if (daysBetween(date, today) < 0) {
                out.push(false);
                continue;
            }
            const items = resolveDay(date, s.template, s.types, s.days[date]);
            out.push(items.some((it) => it.type.mode === 'tilt' && effectiveStatus(it, date, minuteNow) === 'done'));
        }
        return out;
    }, [s, today, minuteNow]);
    const tiltColor = s.types.tilt?.color ?? '#06b6d4';
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-h", children: _jsx("h1", { children: "Takip" }) }), _jsxs("div", { className: "kpis", children: [_jsxs("div", { className: "kpi", children: [_jsxs("b", { className: "num", children: ["%", pct(t.done, t.planned)] }), _jsx("span", { children: "Bug\u00FCn" })] }), _jsxs("div", { className: "kpi", children: [_jsxs("b", { className: "num", children: ["%", pct(judged.done, judged.planned)] }), _jsxs("span", { children: ["Son ", range, " g\u00FCn"] })] }), _jsxs("div", { className: "kpi", children: [_jsx("b", { className: "num", children: s.settings.showStreak ? streak(streakDays) : fmtDuration(judged.doneMin) }), _jsx("span", { children: s.settings.showStreak ? 'Seri (gün)' : 'Odak süresi' })] })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-h", children: _jsx("h2", { children: "Son 7 g\u00FCn" }) }), _jsxs("p", { className: "sub num", children: [fmtDateLong(pickedDay.date), ": ", pickedDay.done, "/", pickedDay.planned, " blok \u00B7 %", pct(pickedDay.done, pickedDay.planned), " \u00B7", ' ', fmtDuration(pickedDay.doneMin), pickedDay.missed ? ` · ${pickedDay.missed} kaçtı` : ''] }), _jsx("div", { className: "bars", role: "list", children: week.days.map((d) => {
                            const p = pct(d.done, d.planned);
                            return (_jsxs("button", { className: "bar", role: "listitem", style: { background: 'none', border: 0, padding: 0 }, "aria-label": `${fmtDateLong(d.date)}: yüzde ${p}`, onClick: () => setPicked(d.date), children: [_jsx("span", { className: "bar-track", style: { outline: d.date === pickedDay.date ? '2px solid var(--ink-3)' : 'none' }, children: _jsx("span", { className: "bar-fill", style: { height: `${p}%`, background: BAR } }) }), _jsx("small", { style: { color: d.date === today ? 'var(--ink)' : undefined }, children: WEEKDAYS_SHORT[weekday(d.date)] })] }, d.date));
                        }) })] }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-h", children: [_jsx("h2", { children: "Bloklara g\u00F6re" }), _jsx(Segmented, { options: [
                                    { value: '7', label: '7 gün' },
                                    { value: '30', label: '30 gün' },
                                ], value: range, onChange: setRange })] }), _jsxs("div", { className: "list", children: [span.byType.map((b) => (_jsxs("div", { className: "hbar list-row", style: { display: 'grid', ...cssVars({ '--c': BAR }) }, children: [_jsxs("span", { className: "row", style: { gap: 8 }, children: [_jsx("span", { className: "color-dot", style: cssVars({ '--c': b.type.color }) }), _jsx("b", { children: b.type.name })] }), _jsxs("span", { className: "num sub", children: [b.done, "/", b.planned, " \u00B7 %", pct(b.done, b.planned)] }), _jsx("span", { className: "hbar-track", children: _jsx("i", { style: { width: `${pct(b.done, b.planned)}%` } }) })] }, b.type.id))), !span.byType.length && _jsx("p", { className: "muted", children: "Hen\u00FCz veri yok." })] })] }), _jsxs("div", { className: "card", style: cssVars({ '--c': tiltColor }), children: [_jsxs("div", { className: "card-h", children: [_jsx("h2", { children: "Pelvis program\u0131" }), _jsxs("span", { className: "pill num", children: ["G\u00FCn ", Math.min(tiltDay, PROGRAM_DAYS), "/", PROGRAM_DAYS] })] }), _jsxs("p", { className: "sub", children: [phaseFor(tiltDay).wk, " \u00B7 ", phaseFor(tiltDay).name, " \u2014 ", tiltDone.filter(Boolean).length, " g\u00FCn yap\u0131ld\u0131. Ka\u00E7\u0131rd\u0131\u011F\u0131n g\u00FCn\u00FC telafi etme, ertesi g\u00FCn devam et."] }), _jsx("div", { className: "dots", children: tiltDone.map((on, i) => (_jsx("span", { className: `dot ${on ? 'on' : ''} ${i + 1 === tiltDay ? 'today' : ''}`, title: `Gün ${i + 1}` }, i))) })] })] }));
}
