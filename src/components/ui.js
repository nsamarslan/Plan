import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { parseHM } from '../lib/time';
import { dismiss, useToasts } from '../services/toast';
export const artUrl = (key) => `./art/${key}.svg`;
export function cssVars(vars) {
    return vars;
}
const paths = {
    now: _jsx("path", { d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2" }),
    today: (_jsxs(_Fragment, { children: [_jsx("rect", { x: "3.5", y: "5", width: "17", height: "15.5", rx: "3" }), _jsx("path", { d: "M3.5 10h17M8 3v4M16 3v4" })] })),
    plan: _jsx("path", { d: "M4 6h10M4 12h16M4 18h7M18 4v4M15 16v4" }),
    stats: _jsx("path", { d: "M5 20V11M12 20V5M19 20v-6" }),
    settings: (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" })] })),
    lock: (_jsxs(_Fragment, { children: [_jsx("rect", { x: "5", y: "10.5", width: "14", height: "10", rx: "2.5" }), _jsx("path", { d: "M8 10.5V8a4 4 0 0 1 8 0v2.5" })] })),
    sound: _jsx("path", { d: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" }),
    mute: _jsx("path", { d: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM16 9.5l5 5M21 9.5l-5 5" }),
    menu: _jsx("path", { d: "M4 7h16M4 12h16M4 17h16" }),
    close: _jsx("path", { d: "M6 6l12 12M18 6 6 18" }),
    plus: _jsx("path", { d: "M12 5v14M5 12h14" }),
    check: _jsx("path", { d: "M5 12.5 10 17l9-10" }),
    skip: _jsx("path", { d: "M6 6l8 6-8 6V6ZM18 6v12" }),
    edit: _jsx("path", { d: "M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" }),
    expand: _jsx("path", { d: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" }),
    trash: _jsx("path", { d: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" }),
    play: _jsx("path", { d: "M7 5v14l12-7L7 5Z" }),
    stop: _jsx("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2" }),
    timer: (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "13.5", r: "7.5" }), _jsx("path", { d: "M12 9.5v4l2.5 2M9.5 2.5h5M12 2.5v3.5" })] })),
};
export function Icon({ name, size }) {
    return (_jsx("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: paths[name] }));
}
export function Ring({ size = 150, stroke = 12, progress, color, children, }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const p = Math.min(1, Math.max(0, progress));
    return (_jsxs("div", { className: "ring", style: { width: size, height: size }, children: [_jsxs("svg", { width: size, height: size, children: [_jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: "rgba(255,255,255,0.12)", strokeWidth: stroke }), _jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeDasharray: c, strokeDashoffset: c * (1 - p), style: { transition: 'stroke-dashoffset 1s linear' } })] }), _jsx("div", { className: "ring-in", children: children })] }));
}
export function Sheet({ title, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (_jsx("div", { className: "scrim", onClick: onClose, children: _jsxs("div", { className: "sheet", role: "dialog", "aria-modal": "true", onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: "sheet-grip" }), _jsxs("div", { className: "sheet-h", children: [_jsx("h2", { children: title }), _jsx("button", { className: "icon-btn", onClick: onClose, "aria-label": "Kapat", children: _jsx(Icon, { name: "close" }) })] }), children] }) }));
}
export function Switch({ label, hint, checked, onChange, }) {
    return (_jsxs("label", { className: "switch", children: [_jsxs("span", { children: [label, hint && _jsx("small", { children: hint })] }), _jsx("input", { type: "checkbox", className: "toggle", checked: checked, onChange: (e) => onChange(e.target.checked) })] }));
}
export function Chips({ options, value, onToggle, }) {
    return (_jsx("div", { className: "chips", children: options.map((o) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": value.includes(o.value), onClick: () => onToggle(o.value), children: o.label }, o.value))) }));
}
export function Segmented({ options, value, onChange, }) {
    return (_jsx("div", { className: "seg", role: "group", children: options.map((o) => (_jsx("button", { type: "button", "aria-pressed": o.value === value, onClick: () => onChange(o.value), children: o.label }, o.value))) }));
}
/** Button that only fires after being held for `ms` (for "escape" actions). Touch, mouse or Space/Enter. */
export function HoldButton({ ms = 5000, onDone, children }) {
    const [p, setP] = useState(0);
    const timer = useRef(undefined);
    const startAt = useRef(0);
    const stop = () => {
        if (timer.current !== undefined)
            cancelAnimationFrame(timer.current);
        timer.current = undefined;
        setP(0);
    };
    const tick = () => {
        const v = (Date.now() - startAt.current) / ms;
        if (v >= 1) {
            timer.current = undefined;
            setP(0);
            onDone();
            return;
        }
        setP(v);
        timer.current = requestAnimationFrame(tick);
    };
    const start = () => {
        if (timer.current !== undefined)
            return;
        startAt.current = Date.now();
        timer.current = requestAnimationFrame(tick);
    };
    useEffect(() => () => {
        if (timer.current !== undefined)
            cancelAnimationFrame(timer.current);
    }, []);
    return (_jsx("button", { type: "button", className: "btn btn-danger hold", style: cssVars({ '--p': p }), onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop, onKeyDown: (e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                start();
            }
        }, onKeyUp: (e) => (e.key === ' ' || e.key === 'Enter') && stop(), onBlur: stop, children: _jsx("span", { children: children }) }));
}
export function Toasts() {
    const list = useToasts();
    return (_jsx("div", { className: "toasts", "aria-live": "polite", children: list.map((t) => (_jsxs("div", { className: "toast", style: cssVars({ '--c': t.color }), onClick: () => dismiss(t.id), children: [_jsx("b", { children: t.title }), t.body && _jsx("span", { children: t.body })] }, t.id))) }));
}
/** Number field that can be typed freely; the value is checked and saved on blur / Enter. */
export function NumberInput({ value, onChange, min, max, step, allowEmpty, decimals, }) {
    const [text, setText] = useState(value === undefined ? '' : String(value));
    useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
    const commit = () => {
        const t = text.trim();
        if (t === '' && allowEmpty)
            return onChange(undefined);
        const raw = Number(t.replace(',', '.'));
        const n = decimals ? raw : Math.round(raw);
        if (!Number.isFinite(n) || n < min || (max !== undefined && n > max)) {
            setText(value === undefined ? '' : String(value));
            return;
        }
        if (n !== value)
            onChange(n);
    };
    return (_jsx("input", { className: "input num", inputMode: decimals ? 'decimal' : 'numeric', type: "number", min: min, max: max, step: step, value: text, onChange: (e) => setText(e.target.value), onBlur: commit, onKeyDown: (e) => e.key === 'Enter' && e.currentTarget.blur() }));
}
export function TimeInput({ value, onChange }) {
    const h = String(Math.floor(value / 60) % 24).padStart(2, '0');
    const m = String(Math.round(value % 60)).padStart(2, '0');
    return (_jsx("input", { className: "input num", type: "time", value: `${h}:${m}`, onChange: (e) => {
            // A cleared field gives ""; ignore it and React shows the old value again.
            const v = parseHM(e.target.value);
            if (v !== null)
                onChange(v);
        } }));
}
