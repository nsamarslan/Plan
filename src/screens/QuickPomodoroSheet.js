import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { cssVars, NumberInput, Sheet, Switch } from '../components/ui';
import { fmt, fmtDuration, minutesOfDay, MIN_MS } from '../lib/time';
import { POMO_PRESETS, QUICK_COLOR, quickDuration } from '../model/quick';
import { getQuickConfig, startQuick } from '../store/quick';
/** Start a pomodoro right now, without picking a block from the plan. */
export function QuickPomodoroSheet({ onClose }) {
    const [c, setC] = useState(getQuickConfig);
    const set = (patch) => setC((x) => ({ ...x, ...patch }));
    const total = quickDuration(c);
    const endsAt = fmt(minutesOfDay(new Date(Date.now() + total * MIN_MS)));
    return (_jsxs(Sheet, { title: "Pomodoro", onClose: onClose, children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Ne \u00FCzerinde \u00E7al\u0131\u015F\u0131yorsun? (iste\u011Fe ba\u011Fl\u0131)" }), _jsx("input", { className: "input", value: c.label, placeholder: "\u00F6rn. LeetCode \u2014 3Sum", onChange: (e) => set({ label: e.target.value }) })] }), _jsx("div", { className: "chips", children: POMO_PRESETS.map((p) => (_jsxs("button", { type: "button", className: "chip", "aria-pressed": p.focus === c.focus && p.brk === c.brk, onClick: () => set({ focus: p.focus, brk: p.brk }), children: [p.focus, " / ", p.brk] }, `${p.focus}/${p.brk}`))) }), _jsxs("div", { className: "grid3", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Odak (dk)" }), _jsx(NumberInput, { min: 5, max: 240, step: 5, value: c.focus, onChange: (v) => v !== undefined && set({ focus: v }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Mola (dk)" }), _jsx(NumberInput, { min: 0, max: 120, step: 5, value: c.brk, onChange: (v) => v !== undefined && set({ brk: v }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Tur" }), _jsx(NumberInput, { min: 1, max: 12, value: c.rounds, onChange: (v) => v !== undefined && set({ rounds: v }) })] })] }), _jsxs("p", { className: "sub num", children: [c.rounds, " tur \u00B7 toplam ", fmtDuration(total), " \u00B7 biti\u015F ", endsAt] }), _jsx(Switch, { label: "Odak modu", hint: "Odak s\u0131ras\u0131nda bildirimler susar (aramalar gelir), di\u011Fer uygulamalar kilitlenir. Molada telefon serbest.", checked: c.lock, onChange: (v) => set({ lock: v }) }), _jsx("button", { className: "btn btn-xl go", style: cssVars({ '--c': QUICK_COLOR }), onClick: () => {
                    startQuick(c);
                    onClose();
                }, children: "Ba\u015Flat" })] }));
}
