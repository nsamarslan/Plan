import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { AppPicker } from '../components/AppPicker';
import { Chips, HoldButton, Icon, NumberInput, Switch, TimeInput } from '../components/ui';
import { dateKey, fmt, WEEK_ORDER, WEEKDAYS_SHORT } from '../lib/time';
import { uid } from '../model/schedule';
import { BUILTIN_ALLOWED, isNative, PlanNative } from '../native/plan';
import { toast } from '../services/toast';
import { allDocKeys, applyRemote, getDoc, updateSettings, useAppState } from '../store/store';
import { clearSupabaseConfig, fullSync, getSupabaseConfig, initSync, resetLocal, setSupabaseConfig, signIn, signOut, signUp, useSyncStatus, } from '../store/sync';
import { AudioSettingsCard } from './AudioSettings';
const dayOptions = WEEK_ORDER.map((d) => ({ value: d, label: WEEKDAYS_SHORT[d] }));
const set = (patch) => updateSettings((x) => ({ ...x, ...patch }));
export function SettingsScreen() {
    const s = useAppState().settings;
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-h", children: _jsx("h1", { children: "Ayarlar" }) }), isNative && _jsx(PermissionsCard, {}), _jsx(FocusCard, {}), _jsx(AudioSettingsCard, {}), _jsx(NotifyCard, {}), _jsxs("div", { className: "card", children: [_jsx("h2", { children: "Pelvis program\u0131" }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ba\u015Flang\u0131\u00E7 g\u00FCn\u00FC (8 hafta buradan say\u0131l\u0131r)" }), _jsx("input", { className: "input", type: "date", value: s.tiltStartDate, onChange: (e) => e.target.value && set({ tiltStartDate: e.target.value }) })] }), _jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => set({ tiltStartDate: dateKey(new Date()) }), children: "Bug\u00FCnden yeniden ba\u015Flat" })] }), _jsxs("div", { className: "card", children: [_jsx("h2", { children: "Takip" }), _jsx(Switch, { label: "Seri (streak) g\u00F6ster", hint: "Bloklar\u0131n\u0131n %80'ini yapt\u0131\u011F\u0131n art arda g\u00FCn say\u0131s\u0131. Bozulunca moral bozuyorsa kapal\u0131 tut.", checked: s.showStreak, onChange: (v) => set({ showStreak: v }) })] }), _jsx(SyncCard, {}), _jsx(DataCard, {}), _jsx("p", { className: "muted", style: { textAlign: 'center' }, children: "Plan \u00B7 v0.1" })] }));
}
function NotifyCard() {
    const s = useAppState().settings;
    const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
    return (_jsxs("div", { className: "card", children: [_jsx("h2", { children: "Bildirimler" }), _jsxs("div", { className: "grid2", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "\u00D6nceden uyar (dk)" }), _jsx(NumberInput, { min: 0, max: 30, value: s.preWarnMin, onChange: (v) => v !== undefined && set({ preWarnMin: v }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ba\u015Flamazsan tekrar (dk)" }), _jsx(NumberInput, { min: 1, max: 30, value: s.remindEveryMin, onChange: (v) => v !== undefined && set({ remindEveryMin: v }) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ka\u00E7 kez tekrar etsin" }), _jsx(NumberInput, { min: 0, max: 10, value: s.remindCount, onChange: (v) => v !== undefined && set({ remindCount: v }) })] }), !isNative && perm !== 'granted' && typeof Notification !== 'undefined' && (_jsx("button", { className: "btn btn-primary", onClick: () => void Notification.requestPermission().then(setPerm), children: "Taray\u0131c\u0131 bildirimlerine izin ver" })), !isNative && _jsx("p", { className: "muted", children: "Web'de bildirimler sadece bu sekme a\u00E7\u0131kken gelir. As\u0131l bildirimler Android uygulamas\u0131nda." })] }));
}
function FocusCard() {
    const s = useAppState().settings;
    const updRange = (id, patch) => set({ dndRanges: s.dndRanges.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
    return (_jsxs("div", { className: "card", children: [_jsx("h2", { children: "Odak modu (Rahats\u0131z Etmeyin)" }), _jsx("p", { className: "muted", children: "Odak modunda bildirimler susar; telefon ve WhatsApp aramalar\u0131 gelmeye devam eder. Uygulama kilidi a\u00E7\u0131ksa sadece bu uygulama, arama ekranlar\u0131 ve izin verdi\u011Fin uygulamalar a\u00E7\u0131l\u0131r." }), _jsx(Switch, { label: "Odak bloklar\u0131nda uygulamalar\u0131 da kilitle", hint: "Kapal\u0131ysa sadece bildirimler susar.", checked: s.lockAppsInDndBlocks, onChange: (v) => set({ lockAppsInDndBlocks: v }) }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Sabit saat aral\u0131klar\u0131" }), _jsx("div", { className: "list", children: s.dndRanges.map((r) => (_jsxs("div", { className: "list-row", style: { flexDirection: 'column', alignItems: 'stretch', gap: 10 }, children: [_jsxs("div", { className: "row", children: [_jsx("input", { className: "input", value: r.label, onChange: (e) => updRange(r.id, { label: e.target.value }) }), _jsx("input", { type: "checkbox", className: "toggle", checked: r.enabled, onChange: (e) => updRange(r.id, { enabled: e.target.checked }), "aria-label": "A\u00E7\u0131k" })] }), _jsxs("div", { className: "grid2", children: [_jsx(TimeInput, { value: r.start, onChange: (v) => updRange(r.id, { start: v }) }), _jsx(TimeInput, { value: r.end, onChange: (v) => updRange(r.id, { end: v }) })] }), _jsx(Chips, { options: dayOptions, value: r.days, onToggle: (d) => updRange(r.id, { days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] }) }), _jsx(Switch, { label: "Bildirimleri sustur", checked: r.silence, onChange: (v) => updRange(r.id, { silence: v }) }), _jsx(Switch, { label: "Uygulamalar\u0131 kilitle", checked: r.lockApps, onChange: (v) => updRange(r.id, { lockApps: v }) }), _jsxs("button", { className: "btn btn-danger btn-sm", onClick: () => set({ dndRanges: s.dndRanges.filter((x) => x.id !== r.id) }), children: [_jsx(Icon, { name: "trash", size: 16 }), " Aral\u0131\u011F\u0131 sil"] })] }, r.id))) }), _jsxs("button", { className: "btn btn-ghost btn-sm", onClick: () => set({
                            dndRanges: [
                                ...s.dndRanges,
                                { id: uid('r'), label: 'Odak', start: 9 * 60, end: 12 * 60, days: [1, 2, 3, 4, 5], silence: true, lockApps: true, enabled: true },
                            ],
                        }), children: [_jsx(Icon, { name: "plus", size: 16 }), " Aral\u0131k ekle"] })] }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Kilitliyken de a\u00E7\u0131labilen uygulamalar" }), _jsxs("p", { className: "muted", children: ["Her zaman a\u00E7\u0131k: ", BUILTIN_ALLOWED.join(', '), "."] }), isNative ? _jsx(AppPicker, { value: s.allowedApps, onChange: (v) => set({ allowedApps: v }) }) : _jsx("p", { className: "muted", children: "Uygulama se\u00E7imi Android'de." })] }), isNative && _jsx(UnlockRow, {})] }));
}
function UnlockRow() {
    const [state, setState] = useState({ active: false });
    useEffect(() => {
        const load = () => void PlanNative.getFocusState().then(setState).catch(() => { });
        load();
        const id = setInterval(load, 10_000);
        return () => clearInterval(id);
    }, []);
    if (!state.active)
        return _jsx("p", { className: "muted", children: "\u015Eu an odak modu kapal\u0131." });
    return (_jsxs("div", { className: "field", children: [_jsxs("span", { children: ["\u015Eu an a\u00E7\u0131k: ", state.label, " ", state.endsAt ? `· ${fmt(new Date(state.endsAt).getHours() * 60 + new Date(state.endsAt).getMinutes())}'e kadar` : ''] }), _jsx(HoldButton, { onDone: () => void PlanNative.unlockFocus().then(() => {
                    toast({ title: 'Odak modu kapatıldı', body: 'Bu bloğun sonuna kadar kilit yok.' });
                    setState({ active: false });
                }), children: "Acil durum: kilidi a\u00E7mak i\u00E7in 5 sn bas\u0131l\u0131 tut" })] }));
}
const PERMS = [
    { name: 'notifications', label: 'Bildirimler', why: 'Blok başlangıç ve hatırlatmaları' },
    { name: 'exactAlarm', label: 'Tam zamanlı alarm', why: 'Bildirimlerin dakikasında gelmesi' },
    { name: 'fullScreen', label: 'Tam ekran bildirim', why: 'Blok başlayınca kilit ekranında resmi göstermek' },
    { name: 'dnd', label: 'Rahatsız Etmeyin erişimi', why: 'Odak modunda bildirimleri susturmak' },
    { name: 'usage', label: 'Kullanım erişimi', why: 'Hangi uygulamanın açık olduğunu görüp kilitlemek' },
    { name: 'overlay', label: 'Diğer uygulamaların üzerinde göster', why: 'Kilitli uygulamanın üstüne odak ekranı koymak' },
    { name: 'battery', label: 'Pil optimizasyonu dışı', why: 'Android uygulamayı uyutmasın' },
];
function PermissionsCard() {
    const [p, setP] = useState(null);
    const refresh = () => void PlanNative.getPermissions().then(setP).catch(() => { });
    useEffect(() => {
        refresh();
        const onVis = () => document.visibilityState === 'visible' && refresh();
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, []);
    if (!p)
        return null;
    const missing = PERMS.filter((x) => !p[x.name]);
    return (_jsxs("div", { className: "card", style: missing.length ? { borderColor: 'var(--warn)' } : undefined, children: [_jsxs("div", { className: "card-h", children: [_jsx("h2", { children: "\u0130zinler" }), missing.length ? _jsxs("span", { className: "perm-no", children: [missing.length, " eksik"] }) : _jsx("span", { className: "perm-ok", children: "Hepsi tamam" })] }), _jsx("div", { className: "list", children: PERMS.map((x) => (_jsxs("div", { className: "list-row", children: [_jsxs("span", { className: "grow", children: [_jsx("b", { children: x.label }), _jsx("small", { children: x.why })] }), p[x.name] ? (_jsx("span", { className: "perm-ok", children: "\u2713" })) : (_jsx("button", { className: "btn btn-sm btn-primary", onClick: () => void PlanNative.requestPermission({ name: x.name }).then(refresh), children: "A\u00E7" }))] }, x.name))) })] }));
}
function SyncCard() {
    const st = useSyncStatus();
    const s = useAppState().settings;
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [msg, setMsg] = useState('');
    const cfg = getSupabaseConfig();
    const [url, setUrl] = useState(cfg?.url ?? '');
    const [key, setKey] = useState(cfg?.key ?? '');
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-h", children: [_jsx("h2", { children: "Senkron (telefon \u2194 web)" }), _jsx("span", { className: st.state === 'error' ? 'perm-no' : 'perm-ok', children: st.state === 'syncing' ? 'Senkronlanıyor…' : st.state === 'error' ? 'Hata' : st.user ? 'Açık' : '' })] }), !st.configured && (_jsxs(_Fragment, { children: [_jsx("p", { className: "muted", children: "Supabase projesinin adresini ve \"anon public\" anahtar\u0131n\u0131 gir (README'de 5 ad\u0131ml\u0131k kurulum var)." }), _jsx("input", { className: "input", placeholder: "https://xxxx.supabase.co", value: url, onChange: (e) => setUrl(e.target.value) }), _jsx("input", { className: "input", placeholder: "anon public key", value: key, onChange: (e) => setKey(e.target.value) }), _jsx("button", { className: "btn btn-primary", onClick: () => {
                            // Stored on this device only, so it can't overwrite the other device's settings.
                            setSupabaseConfig(url, key);
                            initSync();
                        }, children: "Kaydet" })] })), st.configured && !st.user && (_jsxs("form", { className: "field", onSubmit: async (e) => {
                    e.preventDefault();
                    setMsg((await signIn(email, pw)) ?? '');
                }, children: [_jsx("input", { className: "input", type: "email", placeholder: "E-posta", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value) }), _jsx("input", { className: "input", type: "password", placeholder: "\u015Eifre", autoComplete: "current-password", value: pw, onChange: (e) => setPw(e.target.value) }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn btn-primary", type: "submit", style: { flex: 1 }, children: "Giri\u015F yap" }), _jsx("button", { className: "btn", type: "button", style: { flex: 1 }, onClick: async () => setMsg((await signUp(email, pw)) ?? ''), children: "Hesap olu\u015Ftur" })] }), msg && _jsx("p", { className: "muted", children: msg })] })), st.user && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "sub", children: [st.user.email, " \u00B7 ", st.lastSync ? `son: ${new Date(st.lastSync).toLocaleTimeString('tr-TR')}` : ''] }), st.error && _jsx("p", { className: "perm-no", children: st.error }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn btn-sm", onClick: () => void fullSync(), children: "\u015Eimdi senkronla" }), _jsx("button", { className: "btn btn-sm btn-ghost", onClick: () => void signOut(), children: "\u00C7\u0131k\u0131\u015F" })] })] })), st.configured && !cfg?.fromBuild && (_jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => {
                    clearSupabaseConfig();
                    if (s.supabaseUrl || s.supabaseKey)
                        set({ supabaseUrl: undefined, supabaseKey: undefined });
                    location.reload();
                }, children: "Supabase ayar\u0131n\u0131 s\u0131f\u0131rla" }))] }));
}
function DataCard() {
    const file = useRef(null);
    const exportData = async () => {
        const docs = Object.fromEntries(allDocKeys().map((k) => [k, getDoc(k)]));
        const text = JSON.stringify({ app: 'plan', v: 1, docs }, null, 2);
        const name = `plan-yedek-${dateKey(new Date())}.json`;
        if (isNative) {
            // The Android WebView can't download a blob link; save it natively.
            try {
                const { path } = await PlanNative.saveFile({ name, text });
                toast({ title: 'Yedek kaydedildi', body: path });
            }
            catch (e) {
                toast({ title: 'Yedek kaydedilemedi', body: String(e), color: '#f87171' });
            }
            return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        a.download = name;
        a.click();
    };
    const importData = async (f) => {
        if (!f)
            return;
        try {
            const json = JSON.parse(await f.text());
            if (!json || typeof json.docs !== 'object' || !json.docs)
                throw new Error('not a backup');
            // Every record is validated by applyRemote; broken ones are skipped, not stored.
            const now = Date.now();
            let n = 0;
            let skipped = 0;
            for (const [k, env] of Object.entries(json.docs)) {
                if (env && typeof env === 'object' && applyRemote(k, env.data, now))
                    n++;
                else
                    skipped++;
            }
            toast({ title: 'Yedek yüklendi', body: skipped ? `${n} kayıt, ${skipped} bozuk kayıt atlandı` : `${n} kayıt` });
            void fullSync();
        }
        catch {
            toast({ title: 'Dosya okunamadı' });
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsx("h2", { children: "Veri" }), _jsxs("div", { className: "row-wrap", children: [_jsx("button", { className: "btn btn-sm", onClick: () => void exportData(), children: "Yedek indir" }), _jsx("button", { className: "btn btn-sm", onClick: () => file.current?.click(), children: "Yedek y\u00FCkle" }), _jsx("input", { ref: file, type: "file", accept: "application/json", hidden: true, onChange: (e) => {
                            void importData(e.target.files?.[0]);
                            e.target.value = ''; // so picking the same file again still works
                        } })] }), _jsx(HoldButton, { ms: 3000, onDone: () => void resetLocal().then(() => toast({ title: 'Bu cihazdaki veriler sıfırlandı', body: 'Senkron hesabından da çıkış yapıldı.' })), children: "Bu cihazdaki her \u015Feyi s\u0131f\u0131rla (3 sn bas\u0131l\u0131 tut)" })] }));
}
