import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { beep } from '../lib/beep';
import { fmtClock } from '../lib/time';
import { BREATH, MEASURE_DAYS, phaseFor, routineFor, TESTS } from '../model/tilt';
import { cssVars } from './ui';
// Step-by-step pelvis routine. Every exercise is one screen with one big
// button, so there is nothing to decide while doing it.
const BREATH_CYCLE = BREATH.reduce((s, b) => s + b.sec, 0);
const ROUND_PAUSE = 10;
const SIDE_SWITCH = 5;
function useTicker(running) {
    const [, force] = useState(0);
    useEffect(() => {
        if (!running)
            return;
        const id = setInterval(() => force((x) => x + 1), 250);
        return () => clearInterval(id);
    }, [running]);
}
export function TiltGuide({ day, color, onFinish }) {
    const steps = routineFor(day);
    const phase = phaseFor(day);
    const [idx, setIdx] = useState(0);
    const [showTests, setShowTests] = useState(MEASURE_DAYS.includes(day));
    const step = steps[idx];
    const last = idx === steps.length - 1;
    const next = () => (last ? onFinish() : setIdx(idx + 1));
    if (showTests) {
        return (_jsxs("div", { className: "guide", style: cssVars({ '--c': color }), children: [_jsxs("div", { className: "now-kicker", children: ["\u00D6l\u00E7\u00FCm g\u00FCn\u00FC \u00B7 G\u00FCn ", day] }), _jsx("div", { className: "guide-h", children: _jsx("h3", { children: "\u00D6nce 4 test" }) }), _jsx("ol", { children: TESTS.map((t) => (_jsxs("li", { children: [_jsxs("b", { children: [t.name, ":"] }), " ", t.text] }, t.id))) }), _jsx("button", { className: "btn btn-xl go", onClick: () => setShowTests(false), children: "Testleri yapt\u0131m \u2192 Rutine ge\u00E7" })] }));
    }
    return (_jsxs("div", { className: "guide", style: cssVars({ '--c': color }), children: [_jsx("div", { className: "guide-progress", children: steps.map((_, i) => (_jsx("i", { className: i <= idx ? 'on' : '' }, i))) }), _jsxs("div", { className: "now-kicker", children: ["G\u00FCn ", Math.min(day, 56), " \u00B7 ", phase.wk, " \u00B7 ", phase.name] }), _jsxs("div", { className: "guide-h", children: [_jsx("h3", { children: step.ex.name }), _jsx("span", { className: "pill", children: step.ex.dose })] }), _jsx(StepBody, { step: step, onDone: next, last: last }, idx), _jsxs("details", { children: [_jsx("summary", { className: "muted", children: "Nas\u0131l yap\u0131l\u0131r" }), _jsx("ol", { children: step.ex.how.map((h, i) => (_jsx("li", { children: h }, i))) })] }), _jsx("div", { className: "guide-cue", children: step.ex.cue }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn btn-ghost btn-sm", disabled: idx === 0, onClick: () => setIdx(idx - 1), children: "\u2190 Geri" }), _jsx("span", { className: "spacer" }), _jsx("button", { className: "btn btn-ghost btn-sm", onClick: next, children: last ? 'Rutini bitir' : 'Bu adımı geç →' })] })] }));
}
function StepBody({ step, onDone, last }) {
    if (step.kind === 'breath')
        return _jsx(BreathStep, { step: step, onDone: onDone });
    if (step.kind === 'hold')
        return _jsx(HoldStep, { step: step, onDone: onDone });
    return _jsx(RepsStep, { step: step, onDone: onDone, last: last });
}
function BreathStep({ step, onDone }) {
    const [startedAt, setStartedAt] = useState(null);
    useTicker(startedAt !== null);
    const roundLen = step.breaths * BREATH_CYCLE;
    const total = step.rounds * roundLen + (step.rounds - 1) * ROUND_PAUSE;
    const el = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    const lastLabel = useRef('');
    let label = 'Hazır olunca başla';
    let scale = 0.5;
    let dur = 1;
    let round = 1;
    let breath = 1;
    const done = startedAt !== null && el >= total;
    if (startedAt !== null && !done) {
        const block = roundLen + ROUND_PAUSE;
        round = Math.floor(el / block) + 1;
        const inRound = el - (round - 1) * block;
        if (inRound >= roundLen) {
            label = 'Dinlen';
            scale = 0.6;
        }
        else {
            breath = Math.floor(inRound / BREATH_CYCLE) + 1;
            let t = inRound % BREATH_CYCLE;
            for (const b of BREATH) {
                if (t < b.sec) {
                    label = b.label;
                    scale = b.scale;
                    dur = b.sec;
                    break;
                }
                t -= b.sec;
            }
        }
    }
    useEffect(() => {
        if (startedAt && label !== lastLabel.current) {
            lastLabel.current = label;
            if (label === 'Burundan al')
                navigator.vibrate?.(60);
        }
    }, [label, startedAt]);
    useEffect(() => {
        if (done)
            beep(660, 300);
    }, [done]);
    return (_jsxs("div", { className: "guide", children: [_jsx("div", { className: "breath", style: cssVars({ transform: `scale(${scale})`, '--dur': `${dur}s` }) }), _jsx("div", { className: "guide-side", children: done ? 'Tamam' : label }), startedAt !== null && !done && (_jsxs("div", { className: "muted", style: { textAlign: 'center' }, children: ["Tur ", round, "/", step.rounds, " \u00B7 Nefes ", breath, "/", step.breaths] })), startedAt === null ? (_jsx("button", { className: "btn btn-xl go", onClick: () => setStartedAt(Date.now()), children: "Pozisyonday\u0131m, ba\u015Flat" })) : (done && (_jsx("button", { className: "btn btn-xl go", onClick: onDone, children: "Sonraki \u2192" })))] }));
}
function HoldStep({ step, onDone }) {
    const [startedAt, setStartedAt] = useState(null);
    useTicker(startedAt !== null);
    const seg = step.seconds + SIDE_SWITCH;
    const total = step.sides.length * seg - SIDE_SWITCH;
    const el = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    const done = startedAt !== null && el >= total;
    const i = Math.min(step.sides.length - 1, Math.floor(el / seg));
    const inSeg = el - i * seg;
    const switching = !done && startedAt !== null && inSeg >= step.seconds;
    const left = switching ? seg - inSeg : step.seconds - inSeg;
    const lastPhase = useRef('');
    const phaseKey = done ? 'done' : `${i}-${switching}`;
    useEffect(() => {
        if (startedAt === null || phaseKey === lastPhase.current)
            return;
        lastPhase.current = phaseKey;
        beep(phaseKey === 'done' ? 660 : 880);
    }, [phaseKey, startedAt]);
    return (_jsxs("div", { className: "guide", children: [_jsx("div", { className: "guide-side", children: startedAt === null
                    ? `${step.sides[0]} taraf ile başla`
                    : done
                        ? 'Tamam'
                        : switching
                            ? `Taraf değiştir → ${step.sides[i + 1]}`
                            : `${step.sides[i]} taraf · ${i + 1}/${step.sides.length}` }), _jsx("div", { className: "guide-timer num", children: fmtClock(startedAt === null ? step.seconds : done ? 0 : left) }), startedAt === null ? (_jsx("button", { className: "btn btn-xl go", onClick: () => setStartedAt(Date.now()), children: "Pozisyonday\u0131m, ba\u015Flat" })) : (done && (_jsx("button", { className: "btn btn-xl go", onClick: onDone, children: "Sonraki \u2192" })))] }));
}
function RepsStep({ step, onDone, last }) {
    const [set, setSet] = useState(1);
    const [restUntil, setRestUntil] = useState(null);
    useTicker(restUntil !== null);
    const restLeft = restUntil ? (restUntil - Date.now()) / 1000 : 0;
    useEffect(() => {
        if (restUntil !== null && restLeft <= 0) {
            setRestUntil(null);
            setSet((s) => s + 1);
            beep();
        }
    }, [restLeft, restUntil]);
    if (restUntil !== null) {
        return (_jsxs("div", { className: "guide", children: [_jsxs("div", { className: "guide-side", children: ["Dinlen \u00B7 sonra set ", set + 1] }), _jsx("div", { className: "guide-timer num", children: fmtClock(restLeft) }), _jsx("button", { className: "btn btn-ghost", onClick: () => {
                        setRestUntil(null);
                        setSet(set + 1);
                    }, children: "Haz\u0131r\u0131m, devam" })] }));
    }
    const finalSet = set >= step.sets;
    return (_jsxs("div", { className: "guide", children: [_jsxs("div", { className: "guide-side", children: ["Set ", set, "/", step.sets] }), _jsx("div", { className: "guide-timer", children: step.reps }), _jsx("button", { className: "btn btn-xl go", onClick: () => {
                    if (finalSet)
                        onDone();
                    else
                        setRestUntil(Date.now() + step.rest * 1000);
                }, children: finalSet ? (last ? 'Rutin bitti ✓' : 'Set bitti → Sonraki hareket') : 'Set bitti' })] }));
}
