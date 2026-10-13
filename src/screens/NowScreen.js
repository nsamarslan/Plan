import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { setAudioMuted } from '../audio/controller';
import { BREAK_COLOR, PieTimer } from '../components/PieTimer';
import { QUICK_COLOR, quickDuration, quickEndsAt, quickLabel, quickState } from '../model/quick';
import { stopQuick, useQuickSession } from '../store/quick';
import { QuickPomodoroSheet } from './QuickPomodoroSheet';
import { TiltGuide } from '../components/TiltGuide';
import { artUrl, cssVars, Icon, Ring, Sheet } from '../components/ui';
import { useWakeLock } from '../hooks/useWakeLock';
import { addDays, dateKey, DAY_MIN, daysBetween, fmt, fmtClock, fmtDuration, minutesOfDay, msAt, MIN_MS } from '../lib/time';
import { DAILY_HABITS } from '../model/defaults';
import { activeFocus, buildFocusWindows } from '../model/notify';
import { finishItem, nowStateAround, postponeItem, pomodoroAt, resolveDay, skipItem, START_GRACE_MIN, startItem, } from '../model/schedule';
import { dayStats } from '../model/stats';
import { programDay } from '../model/tilt';
import { isNative } from '../native/plan';
import { planInput } from '../services/scheduler';
import { updateDay, updateType, useAppState } from '../store/store';
export function NowScreen({ now, onOpenToday, audio }) {
    const s = useAppState();
    const today = dateKey(new Date(now));
    const items = useMemo(() => resolveDay(today, s.template, s.types, s.days[today]), [today, s.template, s.types, s.days]);
    // A block from yesterday that runs past midnight still shows up here.
    const st = nowStateAround(today, s.template, s.types, s.days, now);
    const { next } = st;
    let { current, currentStatus, currentDate } = st;
    let currentItems = currentDate === today ? items : resolveDay(currentDate, s.template, s.types, s.days[currentDate]);
    // A pelvis routine in progress stays on screen past the block's planned end
    // (up to 30 min) until "Rutini bitir", instead of vanishing mid-exercise.
    const [guideKey, setGuideKey] = useState(null);
    const guideOpen = current?.type.mode === 'tilt' && currentStatus === 'active' ? `${currentDate}|${current.id}` : null;
    useEffect(() => {
        if (guideOpen)
            setGuideKey(guideOpen);
    }, [guideOpen]);
    if (guideKey && guideKey !== guideOpen) {
        const [gDate, gId] = guideKey.split('|');
        const gItems = gDate === today ? items : resolveDay(gDate, s.template, s.types, s.days[gDate]);
        const gi = gItems.find((i) => i.id === gId);
        if (gi && gi.log.status === 'active' && now < msAt(gDate, gi.end) + 30 * MIN_MS) {
            current = gi;
            currentStatus = 'active';
            currentDate = gDate;
            currentItems = gItems;
        }
    }
    const nowMin = minutesOfDay(new Date(now));
    const stats = dayStats(today, items, now);
    const minuteKey = Math.floor(now / MIN_MS);
    const focus = useMemo(() => activeFocus(buildFocusWindows(planInput(minuteKey * MIN_MS)), now), [minuteKey, s]);
    // A standalone pomodoro (started from the timer button) takes the screen.
    const quick = useQuickSession();
    const [quickOpen, setQuickOpen] = useState(false);
    useWakeLock(!!current || !!quick);
    // The note sheet stays bound to the block type it was opened for, even if the
    // block ends while typing.
    const [noteFor, setNoteFor] = useState(null);
    const noteType = noteFor ? s.types[noteFor] : undefined;
    const { wake, sleep } = s.settings;
    // Bedtime may be after midnight (e.g. 00:30), then the night wraps around.
    const night = sleep > wake ? nowMin < wake || nowMin >= sleep : nowMin >= sleep && nowMin < wake;
    const asleep = !current && night;
    const dayOver = !current && !next && !asleep;
    const tomorrowFirst = useMemo(() => {
        const date = nowMin >= s.settings.wake ? addDays(today, 1) : today;
        return resolveDay(date, s.template, s.types, s.days[date]).find((i) => i.type.tracked);
    }, [nowMin, s, today]);
    let art = 'free';
    let color = '#64748b';
    if (quick) {
        color = QUICK_COLOR;
    }
    else if (current) {
        art = current.type.art;
        color = current.type.color;
    }
    else if (asleep || dayOver) {
        art = 'sleep';
        color = '#6366f1';
    }
    const top = (_jsxs("div", { className: "now-top", children: [_jsx("span", { className: "now-clock num", children: fmt(nowMin) }), _jsxs("span", { className: "pill num", title: "Bug\u00FCn tamamlanan bloklar", children: [stats.done, "/", stats.planned] }), focus && (_jsxs("span", { className: "pill focus-pill", children: [_jsx(Icon, { name: "lock" }), " ", focus.label, " \u00B7 ", fmt(minutesOfDay(new Date(focus.end)))] })), _jsx("span", { className: "spacer" }), !quick && (_jsx("button", { className: "icon-btn", "aria-label": "Pomodoro ba\u015Flat", onClick: () => setQuickOpen(true), children: _jsx(Icon, { name: "timer" }) })), audio.wanted && (_jsx("button", { className: "icon-btn", "aria-label": audio.muted ? 'Sesi aç' : 'Sesi kapat', onClick: () => setAudioMuted(audio.muted ? null : audio.key), children: _jsx(Icon, { name: audio.muted ? 'mute' : 'sound' }) })), document.fullscreenEnabled && !isNative && window.innerWidth >= 700 && (_jsx("button", { className: "icon-btn", "aria-label": "Tam ekran", onClick: () => document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen(), children: _jsx(Icon, { name: "expand" }) })), _jsx("button", { className: "icon-btn", "aria-label": "G\u00FCn\u00FCn plan\u0131", onClick: onOpenToday, children: _jsx(Icon, { name: "menu" }) })] }));
    return (_jsxs("div", { className: `now ${!quick && current?.type.mode === 'tilt' && currentStatus === 'active' ? 'now--guide' : ''} ${quick || (current?.type.mode === 'pomodoro' && currentStatus === 'active') ? 'now--pomo' : ''}`, style: cssVars({ '--c': color }), children: [_jsx("img", { className: "now-art", src: artUrl(art), alt: "" }), _jsx("div", { className: "now-shade" }), top, _jsx("div", { className: "now-body", children: quick ? (_jsx(QuickCurrent, { session: quick, now: now, planNow: current, next: next })) : current ? (_jsx(Current, { item: current, status: currentStatus, items: currentItems, today: currentDate, now: now, next: next, onEditNote: setNoteFor })) : asleep || dayOver ? (_jsx(Sleep, { dayOver: dayOver, sleepAt: s.settings.sleep, first: tomorrowFirst })) : (_jsx(Free, { next: next, items: items, today: today, now: now, onQuick: () => setQuickOpen(true) })) }), quickOpen && _jsx(QuickPomodoroSheet, { onClose: () => setQuickOpen(false) }), noteType && (_jsx(NoteSheet, { title: `${noteType.name} — sıradaki`, value: noteType.note, onClose: () => setNoteFor(null), onSave: (v) => updateType(noteType.id, (t) => ({ ...t, note: v })) }))] }));
}
function NextLine({ next }) {
    if (!next)
        return null;
    return (_jsxs("div", { className: "now-next", style: cssVars({ '--nc': next.type.color }), children: [_jsx("i", {}), _jsxs("span", { children: ["Sonra: ", _jsx("b", { className: "num", children: fmt(next.start) }), " ", next.label] })] }));
}
function Current({ item, status, items, today, now, next, onEditNote, }) {
    const s = useAppState();
    const startMs = msAt(today, item.start);
    const endMs = msAt(today, item.end);
    const leftSec = (endMs - now) / 1000;
    const progress = (now - startMs) / (endMs - startMs);
    const lateMin = Math.floor((now - startMs) / MIN_MS);
    const active = status === 'active';
    const type = item.type;
    const start = () => updateDay(today, (d) => startItem(d, items, item.id, Date.now()));
    const finish = () => updateDay(today, (d) => finishItem(d, item.id, Date.now()));
    const skip = () => updateDay(today, (d) => skipItem(d, item.id));
    const later = () => {
        // Minutes on this block's own day (past 24:00 if it started yesterday).
        const t = new Date();
        const nowMin = daysBetween(today, dateKey(t)) * DAY_MIN + minutesOfDay(t);
        updateDay(today, (d) => postponeItem(d, items, item.id, Math.ceil(nowMin) + 15));
    };
    if (active && type.mode === 'tilt') {
        return (_jsxs(_Fragment, { children: [_jsx(TiltGuide, { day: programDay(s.settings.tiltStartDate, today), color: type.color, onFinish: finish }), _jsx(NextLine, { next: next })] }));
    }
    // Phase inside the block (pomodoro focus/break, walk turnaround).
    let phaseLabel = '';
    const ringLabel = active ? 'kaldı' : `${lateMin} dk geçti`;
    const pomo = active && type.mode === 'pomodoro' ? pomodoroAt(item, today, now) : null;
    let kicker = active ? 'Şu an' : lateMin > START_GRACE_MIN ? 'Sıra bunda' : 'Başlama zamanı';
    if (pomo) {
        const brk = pomo.phase.kind === 'break';
        const after = pomo.phases[pomo.index + 1];
        kicker = brk ? 'Mola' : `Odak ${pomo.focusNo}/${pomo.focusTotal}`;
        phaseLabel = brk
            ? 'Kalk, su iç, ekrana bakma'
            : after
                ? `Sonra ${after.end - after.start} dk ${after.kind === 'break' ? 'mola' : 'odak'}`
                : 'Son odak';
    }
    else if (active && type.mode === 'walk') {
        const turnAt = startMs + Math.floor(item.duration / 2) * MIN_MS;
        phaseLabel = now < turnAt ? `Dönüş: ${fmt(minutesOfDay(new Date(turnAt)))}` : 'Eve doğru dön';
    }
    const tips = type.tips ?? [];
    const tip = tips.length ? tips[Math.floor(now / (5 * MIN_MS)) % tips.length] : '';
    return (_jsxs(_Fragment, { children: [active && type.mode === 'meditation' && _jsx("div", { className: "breath breath-loop" }), pomo && (_jsx("div", { className: "pomo-hero", children: _jsx(PieTimer, { className: "pie-timer", phaseLeftSec: pomo.phaseLeftSec, phaseTotalSec: pomo.phaseTotalSec, kind: pomo.phase.kind, color: type.color, phases: pomo.phases, blockMin: item.duration, elapsedMin: pomo.elapsedMin, label: pomo.phase.kind === 'break' ? 'MOLA' : `ODAK ${pomo.focusNo}/${pomo.focusTotal}` }) })), _jsxs("div", { className: "now-main", children: [_jsxs("div", { className: "now-head", children: [_jsx("span", { className: "now-kicker", style: pomo?.phase.kind === 'break' ? { color: BREAK_COLOR } : undefined, children: kicker }), _jsx("h1", { className: "now-title", children: item.label }), _jsxs("span", { className: "now-time num", children: [fmt(item.start), " \u2013 ", fmt(item.end), " \u00B7 ", fmtDuration(item.duration)] }), phaseLabel && _jsx("span", { className: "pill", style: { alignSelf: 'flex-start' }, children: phaseLabel })] }), !pomo && (_jsxs(Ring, { size: 124, stroke: 10, progress: active ? progress : 1, color: active ? type.color : '#fbbf24', children: [_jsx("span", { className: "ring-big num", children: active ? fmtClock(leftSec) : `+${lateMin}` }), _jsx("span", { className: "ring-small", children: ringLabel })] }))] }), !active && (_jsxs("p", { className: "now-step", children: [_jsx("b", { children: "\u0130LK ADIM" }), type.firstStep] })), active && tip && _jsx("p", { className: "now-step", children: tip }), type.note && (_jsxs("button", { className: "note-line", style: { background: 'none', border: 0, padding: 0, textAlign: 'left' }, onClick: () => onEditNote(item.typeId), children: [_jsx(Icon, { name: "edit", size: 16 }), _jsxs("span", { children: ["S\u0131radaki: ", _jsx("b", { children: type.note })] })] })), _jsx("div", { className: "now-actions", children: active ? (_jsxs("div", { className: "row", children: [_jsxs("button", { className: "btn btn-xl go", onClick: finish, children: [_jsx(Icon, { name: "check" }), " Bitti"] }), !type.note && (_jsx("button", { className: "btn btn-ghost", style: { minHeight: 64, flex: 'none', width: 64 }, onClick: () => onEditNote(item.typeId), "aria-label": "S\u0131radaki notu", children: _jsx(Icon, { name: "edit" }) }))] })) : (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btn-xl go", onClick: start, children: lateMin > START_GRACE_MIN ? 'Şimdi başla' : 'Başladım' }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn btn-ghost", onClick: later, children: "15 dk sonra" }), _jsxs("button", { className: "btn btn-ghost", onClick: skip, children: [_jsx(Icon, { name: "skip" }), " Atla"] })] }), lateMin > START_GRACE_MIN && _jsx("span", { className: "muted", children: "\u015Eimdi ba\u015Flarsan sonraki bloklar otomatik kayar." })] })) }), _jsx(NextLine, { next: next })] }));
}
function NoteSheet({ title, value, onSave, onClose }) {
    const [v, setV] = useState(value);
    return (_jsxs(Sheet, { title: title, onClose: onClose, children: [_jsx("p", { className: "sub", children: "Bir dahaki sefere neyle ba\u015Flayacaks\u0131n? Blok ba\u015Flay\u0131nca ekranda yazar, karar vermene gerek kalmaz." }), _jsx("textarea", { className: "input", autoFocus: true, value: v, onChange: (e) => setV(e.target.value), placeholder: "\u00D6rn. Two Sum II, sliding window" }), _jsx("button", { className: "btn btn-primary", onClick: () => {
                    onSave(v.trim());
                    onClose();
                }, children: "Kaydet" })] }));
}
function Free({ next, items, today, now, onQuick, }) {
    const tip = DAILY_HABITS[Math.floor(now / (10 * MIN_MS)) % DAILY_HABITS.length];
    if (!next)
        return null;
    const inSec = (msAt(today, next.start) - now) / 1000;
    const startEarly = () => updateDay(today, (d) => startItem(d, items, next.id, Date.now()));
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "now-main", children: [_jsxs("div", { className: "now-head", children: [_jsx("span", { className: "now-kicker", style: { color: '#94a3b8' }, children: "Serbest zaman" }), _jsx("h1", { className: "now-title", children: "Mola" }), _jsx("span", { className: "now-time", children: "Dinlen, su i\u00E7, hareket et." })] }), _jsxs(Ring, { size: 124, stroke: 10, progress: 1 - Math.min(1, inSec / 3600), color: next.type.color, children: [_jsx("span", { className: "ring-big num", children: fmtClock(inSec) }), _jsx("span", { className: "ring-small", children: "sonra" })] })] }), _jsxs("p", { className: "now-step", children: [_jsx("b", { children: "DURU\u015E" }), tip] }), _jsxs("button", { className: "btn btn-ghost", onClick: onQuick, children: [_jsx(Icon, { name: "timer" }), " Pomodoro ba\u015Flat"] }), _jsxs("div", { className: "now-next", style: cssVars({ '--nc': next.type.color }), children: [_jsx("i", {}), _jsxs("span", { children: ["S\u0131radaki: ", _jsx("b", { className: "num", children: fmt(next.start) }), " ", next.label] }), _jsx("span", { className: "spacer" }), _jsx("button", { className: "btn btn-sm btn-ghost", onClick: startEarly, children: "Erken ba\u015Fla" })] })] }));
}
/** A standalone pomodoro: the same pie, with a stop button. */
function QuickCurrent({ session, now, planNow, next, }) {
    const [confirmStop, setConfirmStop] = useState(false);
    useEffect(() => {
        if (!confirmStop)
            return;
        const t = setTimeout(() => setConfirmStop(false), 3000);
        return () => clearTimeout(t);
    }, [confirmStop]);
    const st = quickState(session, now);
    const brk = st.phase.kind === 'break';
    const after = st.phases[st.index + 1];
    const roundLabel = brk ? 'Mola' : `Odak ${st.focusNo}/${st.focusTotal}`;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "pomo-hero", children: _jsx(PieTimer, { className: "pie-timer", phaseLeftSec: st.phaseLeftSec, phaseTotalSec: st.phaseTotalSec, kind: st.phase.kind, color: QUICK_COLOR, phases: st.phases, blockMin: quickDuration(session), elapsedMin: st.elapsedMin, label: roundLabel.toLocaleUpperCase('tr') }) }), _jsx("div", { className: "now-main", children: _jsxs("div", { className: "now-head", children: [_jsx("span", { className: "now-kicker", style: { color: brk ? BREAK_COLOR : QUICK_COLOR }, children: roundLabel }), _jsx("h1", { className: "now-title", children: quickLabel(session) }), _jsxs("span", { className: "now-time num", children: [session.focus, "/", session.brk, " \u00B7 ", session.rounds, " tur \u00B7 biti\u015F ", fmt(minutesOfDay(new Date(quickEndsAt(session))))] }), _jsx("span", { className: "pill", style: { alignSelf: 'flex-start' }, children: brk ? 'Kalk, su iç, ekrana bakma' : after ? `Sonra ${after.end - after.start} dk ${after.kind === 'break' ? 'mola' : 'odak'}` : 'Son odak' })] }) }), _jsx("div", { className: "now-actions", children: _jsxs("button", { className: `btn ${confirmStop ? 'btn-danger' : 'btn-ghost'}`, style: { minHeight: 56 }, onClick: () => (confirmStop ? stopQuick() : setConfirmStop(true)), children: [_jsx(Icon, { name: "stop" }), " ", confirmStop ? 'Bitirmek için tekrar dokun' : 'Pomodoroyu bitir'] }) }), planNow ? (_jsxs("div", { className: "now-next", style: cssVars({ '--nc': planNow.type.color }), children: [_jsx("i", {}), _jsxs("span", { children: ["Planda \u015Fimdi: ", _jsx("b", { children: planNow.label })] })] })) : (_jsx(NextLine, { next: next }))] }));
}
function Sleep({ dayOver, sleepAt, first }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("span", { className: "now-kicker", style: { color: '#a5b4fc' }, children: dayOver ? 'Gün tamam' : 'Uyku zamanı' }), _jsx("h1", { className: "now-title", children: dayOver ? 'Yavaşla' : 'İyi uykular' }), _jsx("span", { className: "now-time num", children: dayOver ? `Yatış: ${fmt(sleepAt)}. Ekranı bırak.` : 'Telefonu bırak, ışığı kapat.' })] }), first && (_jsxs("div", { className: "now-next", style: cssVars({ '--nc': first.type.color }), children: [_jsx("i", {}), _jsxs("span", { children: [dayOver ? 'Yarın' : 'Sabah', " ilk: ", _jsx("b", { className: "num", children: fmt(first.start) }), " ", first.label] })] }))] }));
}
