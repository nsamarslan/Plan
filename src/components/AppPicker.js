import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { PlanNative } from '../native/plan';
import { Icon, Sheet } from './ui';
let cache = null;
/** Choose Android apps that stay usable while focus mode locks the phone. */
export function AppPicker({ value, onChange }) {
    const [apps, setApps] = useState(cache ?? []);
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    useEffect(() => {
        if (cache)
            return;
        PlanNative.listApps()
            .then((r) => {
            cache = r.apps.sort((a, b) => a.label.localeCompare(b.label, 'tr'));
            setApps(cache);
        })
            .catch(() => { });
    }, []);
    const label = (pkg) => apps.find((a) => a.packageName === pkg)?.label ?? pkg;
    const shown = apps.filter((a) => !value.includes(a.packageName) && a.label.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));
    return (_jsxs("div", { className: "chips", children: [value.map((pkg) => (_jsxs("button", { className: "chip", "aria-pressed": "true", onClick: () => onChange(value.filter((p) => p !== pkg)), children: [label(pkg), " \u2715"] }, pkg))), _jsxs("button", { className: "chip", onClick: () => setOpen(true), children: [_jsx(Icon, { name: "plus", size: 14 }), " Uygulama ekle"] }), open && (_jsxs(Sheet, { title: "Uygulama se\u00E7", onClose: () => setOpen(false), children: [_jsx("input", { className: "input", placeholder: "Ara\u2026", value: q, onChange: (e) => setQ(e.target.value), autoFocus: true }), _jsxs("div", { className: "list", children: [shown.map((a) => (_jsx("button", { className: "list-row", style: { background: 'none', border: 0, textAlign: 'left' }, onClick: () => {
                                    onChange([...value, a.packageName]);
                                    setOpen(false);
                                }, children: _jsxs("span", { className: "grow", children: [_jsx("b", { children: a.label }), _jsx("small", { children: a.packageName })] }) }, a.packageName))), !apps.length && _jsx("p", { className: "muted", children: "Uygulama listesi y\u00FCklenemedi." })] })] }))] }));
}
