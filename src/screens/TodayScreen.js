import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { artUrl, cssVars, Icon, Segmented, Sheet, Switch, TimeInput } from '../components/ui';
import { addDays, dateKey, fmt, fmtDateLong, fmtDuration, minutesOfDay } from '../lib/time';
import { addExtra, clearOverride, effectiveStatus, finishItem, moveItem, removeItem, resetItem, resolveDay, setDuration, skipItem, startItem, uid, } from '../model/schedule';
import { dayStats, pct } from '../model/stats';
import { updateDay, updateTemplate, useAppState } from '../store/store';
export const STATUS_LABEL = {
    upcoming: '',
    late: 'Bekliyor',
    active: 'Şimdi',
    done: 'Tamam',
    skipped: 'Atlandı',
    missed: 'Kaçtı',
};
export function TodayScreen({ now }) {
    const s = useAppState();
    const today = dateKey(new Date(now));
    const [which, setWhich] = useState(() => (minutesOfDay(new Date()) >= 20 * 60 ? 'tomorrow' : 'today'));
    const date = which === 'today' ? today : addDays(today, 1);
    const day = s.days[date];
    const items = useMemo(() => resolveDay(date, s.template, s.types, day), [date, s.template, s.types, day]);
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);
    const st = dayStats(date, items, now);
    const minimal = day?.mode === 'minimal';
    const editItem = items.find((i) => i.id === editing);
    return (_jsxs("div", { className: "page", children: [_jsxs("div", { className: "page-h", children: [_jsx("h1", { children: which === 'today' ? 'Bugün' : 'Yarın' }), _jsx(Segmented, { options: [
                            { value: 'today', label: 'Bugün' },
                            { value: 'tomorrow', label: 'Yarın' },
                        ], value: which, onChange: setWhich })] }), _jsxs("p", { className: "sub", children: [fmtDateLong(date), " \u00B7 ", st.done, "/", st.planned, " blok \u00B7 %", pct(st.done, st.planned)] }), _jsx("div", { className: "card", children: _jsx(Switch, { label: "K\u00F6t\u00FC g\u00FCn modu", hint: "Sadece temel bloklar kal\u0131r: pelvis, sabah y\u00FCr\u00FCy\u00FC\u015F\u00FC, 1 saat DSA. Hi\u00E7 yapmamaktan iyidir.", checked: minimal, onChange: (v) => updateDay(date, (d) => ({ ...d, mode: v ? 'minimal' : 'normal' })) }) }), _jsx(Timeline, { items: items, date: date, now: now, onPick: setEditing }), _jsxs("button", { className: "btn btn-ghost", onClick: () => setAdding(true), children: [_jsx(Icon, { name: "plus" }), " Bu g\u00FCne blok ekle"] }), editItem && _jsx(ItemSheet, { item: editItem, items: items, date: date, onClose: () => setEditing(null) }), adding && (_jsx(AddBlockSheet, { types: s.typeOrder.map((id) => s.types[id]), onClose: () => setAdding(false), onPick: (t) => {
                    const lastEnd = items.length ? Math.max(...items.map((i) => i.end)) : s.settings.wake;
                    const nowMin = Math.ceil(minutesOfDay(new Date()) / 5) * 5;
                    const start = which === 'today' ? Math.max(nowMin, Math.min(lastEnd, s.settings.sleep - 30)) : s.settings.wake;
                    const id = uid('e');
                    updateDay(date, (d) => addExtra(d, { id, typeId: t.id, start, duration: 30, days: [] }));
                    setAdding(false);
                    setEditing(id);
                } }))] }));
}
export function Timeline({ items, date, now, onPick, }) {
    return (_jsxs("div", { className: "tl", children: [items.map((it, i) => {
                const st = effectiveStatus(it, date, now);
                const prev = items[i - 1];
                const gap = prev ? it.start - prev.end : 0;
                const isNow = st === 'active' || st === 'late';
                return (_jsxs("div", { style: { display: 'contents' }, children: [gap >= 10 && _jsxs("div", { className: "tl-gap", children: ["\u00B7 serbest ", fmtDuration(gap)] }), gap < 0 && _jsxs("div", { className: "tl-gap", style: { color: 'var(--warn)' }, children: ["\u00B7 ", fmtDuration(-gap), " \u00E7ak\u0131\u015Fma"] }), _jsxs("button", { className: `tl-item ${isNow ? 'is-now' : ''} ${st === 'skipped' || (!it.type.tracked && st === 'missed') ? 'is-dim' : ''}`, style: cssVars({ '--c': it.type.color }), onClick: () => onPick(it.id), children: [_jsxs("span", { className: "tl-time num", children: [fmt(it.start), _jsx("small", { children: fmt(it.end) })] }), _jsx("span", { className: "tl-bar" }), _jsxs("span", { children: [_jsxs("span", { className: "tl-name", children: [it.label, it.dnd && _jsx(Icon, { name: "lock" })] }), _jsxs("span", { className: "tl-meta", children: [fmtDuration(it.duration), it.moved ? ' · kaydırıldı' : '', it.extra ? ' · sadece bu gün' : ''] })] }), STATUS_LABEL[st] && (it.type.tracked || st === 'active') ? _jsx("span", { className: `status st-${st}`, children: STATUS_LABEL[st] }) : _jsx("span", {})] })] }, it.id));
            }), !items.length && _jsx("p", { className: "muted", children: "Bu g\u00FCn i\u00E7in blok yok." })] }));
}
function Stepper({ value, onChange, step = 15, render }) {
    return (_jsxs("div", { className: "stepper", children: [_jsxs("button", { className: "btn", onClick: () => onChange(value - step), children: ["\u2212", step] }), _jsx("div", { style: { flex: 1 }, children: render }), _jsxs("button", { className: "btn", onClick: () => onChange(value + step), children: ["+", step] })] }));
}
function ItemSheet({ item, items, date, onClose }) {
    const s = useAppState();
    const today = dateKey(new Date());
    const st = effectiveStatus(item, date, Date.now());
    const tpl = s.template.find((t) => t.id === item.id);
    const upd = (fn) => updateDay(date, fn);
    const move = (start) => upd((d) => moveItem(d, items, item.id, Math.max(0, Math.min(24 * 60 - 5, start))));
    const saveToTemplate = () => {
        if (!tpl)
            return;
        // Only what was changed for this day goes into the template; on a bad
        // (minimal) day the shorter duration is not a real change.
        const ov = s.days[date]?.overrides[item.id] ?? {};
        const patch = {};
        if (ov.start !== undefined)
            patch.start = Math.min(ov.start, 24 * 60 - 5);
        if (ov.duration !== undefined)
            patch.duration = ov.duration;
        if (ov.dnd !== undefined)
            patch.dnd = ov.dnd;
        updateTemplate((list) => list.map((t) => (t.id === item.id ? { ...t, ...patch } : t)));
        upd((d) => clearOverride(d, item.id));
    };
    return (_jsxs(Sheet, { title: _jsxs("span", { className: "row", style: cssVars({ '--c': item.type.color }), children: [_jsx("span", { className: "color-dot" }), " ", item.label] }), onClose: onClose, children: [_jsxs("div", { className: "field", children: [_jsx("span", { children: "Ba\u015Flang\u0131\u00E7 (sonraki bloklar gerekirse kayar)" }), _jsx(Stepper, { value: item.start, onChange: move, render: _jsx(TimeInput, { value: item.start, onChange: move }) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "S\u00FCre" }), _jsx(Stepper, { value: item.duration, onChange: (v) => upd((d) => setDuration(d, items, item.id, Math.max(5, v))), render: _jsx("div", { className: "input num", style: { display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: fmtDuration(item.duration) }) })] }), _jsx(Switch, { label: "Odak modu", hint: "Bildirimler susar (aramalar gelir), di\u011Fer uygulamalar kilitlenir.", checked: item.dnd, onChange: (v) => upd((d) => ({ ...d, overrides: { ...d.overrides, [item.id]: { ...d.overrides[item.id], dnd: v } } })) }), date === today && (_jsxs("div", { className: "row-wrap", children: [st !== 'active' && st !== 'done' && (_jsx("button", { className: "btn btn-primary", onClick: () => (upd((d) => startItem(d, items, item.id, Date.now())), onClose()), children: "Ba\u015Flad\u0131m" })), st !== 'done' && (_jsxs("button", { className: "btn", onClick: () => (upd((d) => finishItem(d, item.id, Date.now())), onClose()), children: [_jsx(Icon, { name: "check" }), " Yapt\u0131m"] })), st !== 'skipped' && st !== 'done' && (_jsx("button", { className: "btn", onClick: () => (upd((d) => skipItem(d, item.id)), onClose()), children: "Atla" })), (st === 'done' || st === 'skipped' || st === 'active') && (_jsx("button", { className: "btn btn-ghost", onClick: () => upd((d) => resetItem(d, item.id)), children: "Durumu s\u0131f\u0131rla" }))] })), _jsxs("div", { className: "row-wrap", children: [item.moved && tpl && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btn-ghost btn-sm", onClick: saveToTemplate, children: "Her g\u00FCn b\u00F6yle olsun" }), _jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => upd((d) => clearOverride(d, item.id)), children: "Plandaki saate d\u00F6n" })] })), _jsx("span", { className: "spacer" }), _jsxs("button", { className: "btn btn-danger btn-sm", onClick: () => {
                            upd((d) => removeItem(d, item.id));
                            onClose();
                        }, children: [_jsx(Icon, { name: "trash", size: 16 }), " ", item.extra ? 'Sil' : 'Bu günden kaldır'] })] })] }));
}
export function AddBlockSheet({ types, onPick, onClose }) {
    return (_jsx(Sheet, { title: "Blok se\u00E7", onClose: onClose, children: _jsx("div", { className: "type-grid", children: types.map((t) => (_jsxs("button", { className: "type-card", style: cssVars({ '--c': t.color }), onClick: () => onPick(t), children: [_jsx("img", { src: artUrl(t.art), alt: "" }), _jsx("span", { children: t.name })] }, t.id))) }) }));
}
