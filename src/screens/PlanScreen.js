import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { artUrl, Chips, cssVars, Icon, NumberInput, Sheet, Switch, TimeInput } from '../components/ui';
import { AppPicker } from '../components/AppPicker';
import { addDays, ALL_DAYS, dateKey, fmtDuration, WEEK_ORDER, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekday } from '../lib/time';
import { POMO_PRESETS } from '../model/quick';
import { pomodoroLengths, pomodoroPhases, resolveDay, uid } from '../model/schedule';
import { isNative } from '../native/plan';
import { addType, updateSettings, updateTemplate, updateType, useAppState } from '../store/store';
import { AddBlockSheet, Timeline } from './TodayScreen';
const dayOptions = WEEK_ORDER.map((d) => ({ value: d, label: WEEKDAYS_SHORT[d] }));
export function PlanScreen() {
    const s = useAppState();
    const today = dateKey(new Date());
    const [wd, setWd] = useState(() => weekday(today));
    const sample = addDays(today, (wd - weekday(today) + 7) % 7);
    const items = useMemo(() => resolveDay(sample, s.template, s.types, undefined), [sample, s.template, s.types]);
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);
    const [editType, setEditType] = useState(null);
    const total = items.filter((i) => i.type.tracked).reduce((n, i) => n + i.duration, 0);
    const editItem = s.template.find((t) => t.id === editing);
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-h", children: _jsx("h1", { children: "Plan" }) }), _jsx("p", { className: "sub", children: "Her g\u00FCn\u00FCn varsay\u0131lan plan\u0131. Bug\u00FCn\u00FC de\u011Fi\u015Ftirmek i\u00E7in \"Bug\u00FCn\" sekmesini kullan \u2014 buradaki de\u011Fi\u015Fiklikler her hafta tekrar eder." }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "grid2", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Kalk\u0131\u015F" }), _jsx(TimeInput, { value: s.settings.wake, onChange: (v) => updateSettings((x) => ({ ...x, wake: v })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Yat\u0131\u015F" }), _jsx(TimeInput, { value: s.settings.sleep, onChange: (v) => updateSettings((x) => ({ ...x, sleep: v })) })] })] }), _jsxs("p", { className: "muted", children: ["Uyku: ", fmtDuration((s.settings.wake - s.settings.sleep + 24 * 60) % (24 * 60)), ". Her g\u00FCn ayn\u0131 saatte kalk."] })] }), _jsx("div", { className: "row-wrap", children: WEEK_ORDER.map((d) => (_jsx("button", { className: "chip", "aria-pressed": d === wd, onClick: () => setWd(d), children: WEEKDAYS_SHORT[d] }, d))) }), _jsxs("p", { className: "sub", children: [WEEKDAYS_LONG[wd], ": ", items.filter((i) => i.type.tracked).length, " blok \u00B7 ", fmtDuration(total)] }), _jsx(Timeline, { items: items, date: sample, now: 0, onPick: setEditing }), _jsxs("button", { className: "btn btn-ghost", onClick: () => setAdding(true), children: [_jsx(Icon, { name: "plus" }), " Plana blok ekle"] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-h", children: _jsx("h2", { children: "Blok t\u00FCrleri" }) }), _jsx("p", { className: "muted", children: "Her t\u00FCr\u00FCn bildirimi, resmi, ilk ad\u0131m\u0131 ve odak ayar\u0131 sabittir; sadece saati de\u011Fi\u015Fir." }), _jsx("div", { className: "list", children: s.typeOrder.map((id) => {
                            const t = s.types[id];
                            return (_jsxs("button", { className: "list-row", style: { background: 'none', border: 0, textAlign: 'left', ...cssVars({ '--c': t.color }) }, onClick: () => setEditType(id), children: [_jsx("img", { className: "tl-thumb", src: artUrl(t.art), alt: "" }), _jsxs("span", { className: "grow", children: [_jsx("b", { children: t.name }), _jsxs("small", { children: [t.dnd ? 'Odak modu · ' : '', t.focusAudio ? 'Sesli odak · ' : '', t.firstStep] })] }), _jsx(Icon, { name: "edit", size: 18 })] }, id));
                        }) }), _jsxs("button", { className: "btn btn-ghost btn-sm", onClick: () => {
                            const id = uid('type');
                            addType({
                                id,
                                name: 'Yeni blok',
                                color: '#38bdf8',
                                art: 'free',
                                firstStep: 'İlk küçük adımı yaz.',
                                mode: 'timer',
                                tracked: true,
                                dnd: false,
                                notify: true,
                                focusAudio: false,
                                allowedApps: [],
                                note: '',
                            });
                            setEditType(id);
                        }, children: [_jsx(Icon, { name: "plus", size: 16 }), " Yeni blok t\u00FCr\u00FC"] })] }), editItem && _jsx(TemplateItemSheet, { item: editItem, onClose: () => setEditing(null) }), adding && (_jsx(AddBlockSheet, { types: s.typeOrder.map((id) => s.types[id]), onClose: () => setAdding(false), onPick: (t) => {
                    const id = uid('t');
                    const lastEnd = items.length ? Math.max(...items.map((i) => i.end)) : s.settings.wake;
                    updateTemplate((list) => [...list, { id, typeId: t.id, start: Math.min(lastEnd, s.settings.sleep - 30), duration: 30, days: [...ALL_DAYS] }]);
                    setAdding(false);
                    setEditing(id);
                } })), editType && s.types[editType] && _jsx(TypeSheet, { type: s.types[editType], onClose: () => setEditType(null) })] }));
}
function TemplateItemSheet({ item, onClose }) {
    const s = useAppState();
    const type = s.types[item.typeId];
    const upd = (patch) => updateTemplate((list) => list.map((t) => (t.id === item.id ? { ...t, ...patch } : t)));
    return (_jsxs(Sheet, { title: _jsxs("span", { className: "row", style: cssVars({ '--c': type?.color }), children: [_jsx("span", { className: "color-dot" }), " ", item.label || type?.name] }), onClose: onClose, children: [_jsxs("label", { className: "field", children: [_jsxs("span", { children: ["\u0130sim (bo\u015F: ", type?.name, ")"] }), _jsx("input", { className: "input", value: item.label ?? '', onChange: (e) => upd({ label: e.target.value || undefined }) })] }), _jsxs("div", { className: "grid2", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Ba\u015Flang\u0131\u00E7" }), _jsx(TimeInput, { value: item.start, onChange: (v) => upd({ start: v }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "S\u00FCre (dk)" }), _jsx(NumberInput, { min: 5, max: 24 * 60, step: 5, value: item.duration, onChange: (v) => v !== undefined && upd({ duration: v }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "G\u00FCnler" }), _jsx(Chips, { options: dayOptions, value: item.days, onToggle: (d) => upd({ days: item.days.includes(d) ? item.days.filter((x) => x !== d) : [...item.days, d] }) })] }), _jsx(Switch, { label: "Odak modu", hint: `Varsayılan: ${type?.dnd ? 'açık' : 'kapalı'} (blok türünden)`, checked: item.dnd ?? type?.dnd ?? false, onChange: (v) => upd({ dnd: v }) }), _jsx(Switch, { label: "K\u00F6t\u00FC g\u00FCn modunda da kals\u0131n", checked: !!item.minimal, onChange: (v) => upd({ minimal: v }) }), item.minimal && (_jsxs("label", { className: "field", children: [_jsx("span", { children: "K\u00F6t\u00FC g\u00FCn s\u00FCresi (dk, bo\u015F: ayn\u0131)" }), _jsx(NumberInput, { min: 5, max: 24 * 60, step: 5, allowEmpty: true, value: item.minimalDuration, onChange: (v) => upd({ minimalDuration: v }) })] })), _jsxs("button", { className: "btn btn-danger", onClick: () => {
                    updateTemplate((list) => list.filter((t) => t.id !== item.id));
                    onClose();
                }, children: [_jsx(Icon, { name: "trash", size: 16 }), " Plandan sil"] })] }));
}
const ARTS = ['tilt', 'walk', 'weights', 'reading', 'meditation', 'dsa', 'design', 'ai', 'review', 'meal', 'free', 'sleep'];
const MODES = [
    { value: 'timer', label: 'Sayaç' },
    { value: 'pomodoro', label: 'Pomodoro (odak / mola)' },
    { value: 'walk', label: 'Yürüyüş (yarıda dönüş)' },
    { value: 'meditation', label: 'Meditasyon (nefes)' },
    { value: 'tilt', label: 'Pelvis rehberi' },
];
function PomodoroEditor({ type, onChange }) {
    const s = useAppState();
    const { focus, brk } = pomodoroLengths(type);
    // How this splits the blocks of this type that are in the plan.
    const durations = [...new Set(s.template.filter((t) => t.typeId === type.id).map((t) => t.duration))].sort((a, b) => b - a);
    return (_jsxs("div", { className: "field", children: [_jsx("span", { children: "Pomodoro" }), _jsx("div", { className: "chips", children: POMO_PRESETS.map((p) => (_jsxs("button", { type: "button", className: "chip", "aria-pressed": p.focus === focus && p.brk === brk, onClick: () => onChange({ focusMin: p.focus, breakMin: p.brk }), children: [p.focus, " / ", p.brk] }, `${p.focus}/${p.brk}`))) }), _jsxs("div", { className: "grid2", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Odak (dk)" }), _jsx(NumberInput, { min: 5, max: 240, step: 5, value: focus, onChange: (v) => v !== undefined && onChange({ focusMin: v }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Mola (dk, 0 = yok)" }), _jsx(NumberInput, { min: 0, max: 120, step: 5, value: brk, onChange: (v) => v !== undefined && onChange({ breakMin: v }) })] })] }), durations.map((d) => (_jsxs("p", { className: "muted", children: [fmtDuration(d), ":", ' ', pomodoroPhases(d, focus, brk)
                        .map((p) => `${p.end - p.start} ${p.kind === 'focus' ? 'odak' : 'mola'}`)
                        .join(' · ')] }, d)))] }));
}
function TypeSheet({ type, onClose }) {
    const upd = (patch) => updateType(type.id, (t) => ({ ...t, ...patch }));
    return (_jsxs(Sheet, { title: type.name, onClose: onClose, children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "\u0130sim" }), _jsx("input", { className: "input", value: type.name, onChange: (e) => upd({ name: e.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "\u0130lk ad\u0131m (bildirimde ve ekranda yazar)" }), _jsx("textarea", { className: "input", value: type.firstStep, onChange: (e) => upd({ firstStep: e.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "S\u0131radaki (bir dahaki sefere ne yapacaks\u0131n)" }), _jsx("input", { className: "input", value: type.note, onChange: (e) => upd({ note: e.target.value }) })] }), _jsxs("div", { className: "grid2", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Renk" }), _jsx("input", { className: "input", type: "color", value: type.color, onChange: (e) => upd({ color: e.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ekran" }), _jsx("select", { className: "input", value: type.mode, onChange: (e) => upd({ mode: e.target.value }), children: MODES.map((m) => (_jsx("option", { value: m.value, children: m.label }, m.value))) })] })] }), type.mode === 'pomodoro' && _jsx(PomodoroEditor, { type: type, onChange: upd }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Resim" }), _jsx("div", { className: "type-grid", style: { gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }, children: ARTS.map((a) => (_jsx("button", { className: "type-card", style: cssVars({ '--c': a === type.art ? type.color : 'transparent', outline: a === type.art ? `2px solid ${type.color}` : 'none' }), onClick: () => upd({ art: a }), children: _jsx("img", { src: artUrl(a), alt: a }) }, a))) })] }), _jsx(Switch, { label: "Odak modu (varsay\u0131lan)", hint: "Bildirimler susar, aramalar gelir, di\u011Fer uygulamalar kilitlenir.", checked: type.dnd, onChange: (v) => upd({ dnd: v }) }), _jsx(Switch, { label: "Bildirimler", hint: "5 dk \u00F6nce, ba\u015Flang\u0131\u00E7ta, ba\u015Flamazsan tekrar, biti\u015Fte.", checked: type.notify, onChange: (v) => upd({ notify: v }) }), _jsx(Switch, { label: "Sesli odak", hint: "Bu blokta arka plan m\u00FCzi\u011Fi ve sesli komutlar \u00E7alar.", checked: type.focusAudio, onChange: (v) => upd({ focusAudio: v }) }), _jsx(Switch, { label: "Takipte say", checked: type.tracked, onChange: (v) => upd({ tracked: v }) }), isNative && (_jsxs("div", { className: "field", children: [_jsx("span", { children: "Bu blokta kilit a\u00E7\u0131k kalacak uygulamalar" }), _jsx(AppPicker, { value: type.allowedApps, onChange: (v) => upd({ allowedApps: v }) })] }))] }));
}
