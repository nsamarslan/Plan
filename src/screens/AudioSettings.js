import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { addAudio, deleteAudio, listAudio } from '../audio/db';
import { setAudioTest, useAudioTest } from '../audio/controller';
import { previewCue } from '../audio/engine';
import { Icon, NumberInput, Segmented, Switch } from '../components/ui';
import { uid } from '../model/schedule';
import { isNative, PlanNative } from '../native/plan';
import { updateSettings, useAppState } from '../store/store';
const LANGS = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'tr-TR', label: 'Türkçe' },
];
function useVoices(lang) {
    const [voices, setVoices] = useState([]);
    useEffect(() => {
        if (isNative) {
            PlanNative.listVoices()
                .then((r) => setVoices(r.voices))
                .catch(() => { });
            return;
        }
        const synth = window.speechSynthesis;
        if (!synth)
            return;
        const load = () => setVoices(synth.getVoices().map((v) => ({ name: v.name, lang: v.lang })));
        load();
        synth.addEventListener('voiceschanged', load);
        return () => synth.removeEventListener('voiceschanged', load);
    }, []);
    const prefix = lang.slice(0, 2).toLowerCase();
    return voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix));
}
export function AudioSettingsCard() {
    const s = useAppState();
    const a = s.settings.audio;
    const set = (patch) => updateSettings((x) => ({ ...x, audio: { ...x.audio, ...patch } }));
    const [files, setFiles] = useState([]);
    const [newPhrase, setNewPhrase] = useState('');
    const testing = useAudioTest();
    // Leaving Ayarlar ends the test.
    useEffect(() => () => setAudioTest(false), []);
    const voices = useVoices(a.lang);
    const refresh = () => void listAudio().then(setFiles);
    useEffect(refresh, []);
    const music = files.filter((f) => f.kind === 'music');
    const clips = files.filter((f) => f.kind === 'voice');
    const onImport = async (list, kind) => {
        if (!list)
            return;
        const added = [];
        for (const f of Array.from(list))
            added.push(await addAudio(f, kind));
        if (kind === 'music')
            set({ musicIds: [...a.musicIds, ...added.map((x) => x.id)], musicEnabled: true });
        else
            set({ clipIds: [...a.clipIds, ...added.map((x) => x.id)] });
        refresh();
    };
    const remove = async (f) => {
        await deleteAudio(f.id);
        set({ musicIds: a.musicIds.filter((x) => x !== f.id), clipIds: a.clipIds.filter((x) => x !== f.id) });
        refresh();
    };
    const toggleIn = (key, id) => set({ [key]: a[key].includes(id) ? a[key].filter((x) => x !== id) : [...a[key], id] });
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-h", children: _jsx("h2", { children: "Sesli odak" }) }), _jsx("p", { className: "muted", children: "Arka planda m\u00FCzik \u00E7alar, arada bir dikkatini geri \u00E7a\u011F\u0131ran bir c\u00FCmle s\u00F6ylenir. Ses dosyalar\u0131 bu cihazda saklan\u0131r." }), _jsx(Switch, { label: "Sesli komutlar", checked: a.voiceEnabled, onChange: (v) => set({ voiceEnabled: v }) }), _jsx(Switch, { label: "Arka plan m\u00FCzi\u011Fi", checked: a.musicEnabled, onChange: (v) => set({ musicEnabled: v }) }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Ne zaman \u00E7als\u0131n" }), _jsx(Segmented, { options: [
                            { value: 'focusBlocks', label: 'Sesli odak bloklarında' },
                            { value: 'always', label: 'Uygulama açıkken' },
                        ], value: a.when, onChange: (v) => set({ when: v }) }), _jsx("span", { className: "muted", children: "\"Sesli odak bloklar\u0131\": DSA, System Design, AI uygulamas\u0131 (Plan \u2192 Blok t\u00FCrleri'nden de\u011Fi\u015Ftir). Blok ba\u015Flay\u0131nca \u00E7alar." })] }), _jsxs("div", { className: "grid2", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "En az aral\u0131k (dk)" }), _jsx(NumberInput, { decimals: true, min: 0.25, max: 240, step: 0.5, value: a.minSec / 60, onChange: (v) => v !== undefined && set({ minSec: Math.round(v * 60) }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "En \u00E7ok aral\u0131k (dk)" }), _jsx(NumberInput, { decimals: true, min: 0.25, max: 240, step: 0.5, value: a.maxSec / 60, onChange: (v) => v !== undefined && set({ maxSec: Math.round(v * 60) }) })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "M\u00FCzik sesi" }), _jsx("input", { type: "range", min: 0, max: 1, step: 0.05, value: a.musicVolume, onChange: (e) => set({ musicVolume: Number(e.target.value) }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Konu\u015Fma sesi" }), _jsx("input", { type: "range", min: 0, max: 1, step: 0.05, value: a.voiceVolume, onChange: (e) => set({ voiceVolume: Number(e.target.value) }) })] }), _jsxs("div", { className: "grid2", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Dil" }), _jsx("select", { className: "input", value: a.lang, onChange: (e) => set({ lang: e.target.value, voiceName: '' }), children: LANGS.map((l) => (_jsx("option", { value: l.value, children: l.label }, l.value))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ses" }), _jsxs("select", { className: "input", value: a.voiceName, onChange: (e) => set({ voiceName: e.target.value }), children: [_jsx("option", { value: "", children: "Varsay\u0131lan" }), voices.map((v) => (_jsx("option", { value: v.name, children: v.name }, v.name)))] })] })] }), _jsxs("div", { className: "grid2", children: [_jsxs("label", { className: "field", children: [_jsxs("span", { children: ["H\u0131z ", a.rate.toFixed(2)] }), _jsx("input", { type: "range", min: 0.5, max: 1.5, step: 0.05, value: a.rate, onChange: (e) => set({ rate: Number(e.target.value) }) })] }), _jsxs("label", { className: "field", children: [_jsxs("span", { children: ["Ton ", a.pitch.toFixed(2)] }), _jsx("input", { type: "range", min: 0.5, max: 1.5, step: 0.05, value: a.pitch, onChange: (e) => set({ pitch: Number(e.target.value) }) })] })] }), _jsxs("div", { className: "row-wrap", children: [_jsxs("button", { className: "btn btn-sm", onClick: () => void previewCue(a, 'DSA'), children: [_jsx(Icon, { name: "play", size: 16 }), " Bir c\u00FCmle dinle"] }), _jsxs("button", { className: "btn btn-sm", onClick: () => setAudioTest(!testing), children: [_jsx(Icon, { name: testing ? 'stop' : 'play', size: 16 }), " ", testing ? 'Testi durdur' : 'Hepsini test et'] })] }), _jsxs("div", { className: "field", children: [_jsxs("span", { children: ["C\u00FCmleler (", a.phrases.filter((p) => p.enabled).length, " a\u00E7\u0131k) \u2014 ", '{block}', " o anki blo\u011Fun ad\u0131 olur"] }), _jsx("div", { className: "list", children: a.phrases.map((p) => (_jsxs("div", { className: "list-row", children: [_jsx("input", { type: "checkbox", className: "toggle", checked: p.enabled, onChange: (e) => set({ phrases: a.phrases.map((x) => (x.id === p.id ? { ...x, enabled: e.target.checked } : x)) }) }), _jsx("input", { className: "input grow", value: p.text, onChange: (e) => set({ phrases: a.phrases.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)) }) }), _jsx("button", { className: "icon-btn", "aria-label": "Sil", onClick: () => set({ phrases: a.phrases.filter((x) => x.id !== p.id) }), children: _jsx(Icon, { name: "trash", size: 18 }) })] }, p.id))) }), _jsxs("form", { className: "row", onSubmit: (e) => {
                            e.preventDefault();
                            if (!newPhrase.trim())
                                return;
                            set({ phrases: [...a.phrases, { id: uid('p'), text: newPhrase.trim(), enabled: true }] });
                            setNewPhrase('');
                        }, children: [_jsx("input", { className: "input", placeholder: "Yeni c\u00FCmle\u2026", value: newPhrase, onChange: (e) => setNewPhrase(e.target.value) }), _jsx("button", { className: "btn", type: "submit", children: "Ekle" })] })] }), _jsx(AudioFileList, { title: "M\u00FCzik dosyalar\u0131 (se\u00E7ililer s\u0131rayla \u00E7alar, tek dosya kesintisiz d\u00F6ner)", files: music, selected: a.musicIds, onToggle: (id) => toggleIn('musicIds', id), onRemove: remove, onImport: (fl) => void onImport(fl, 'music') }), _jsx(AudioFileList, { title: "Ses kay\u0131tlar\u0131 (c\u00FCmlelerin aras\u0131nda rastgele \u00E7alar)", files: clips, selected: a.clipIds, onToggle: (id) => toggleIn('clipIds', id), onRemove: remove, onImport: (fl) => void onImport(fl, 'voice') })] }));
}
function AudioFileList({ title, files, selected, onToggle, onRemove, onImport, }) {
    const input = useRef(null);
    return (_jsxs("div", { className: "field", children: [_jsx("span", { children: title }), _jsx("div", { className: "list", children: files.map((f) => (_jsxs("div", { className: "list-row", children: [_jsx("input", { type: "checkbox", className: "toggle", checked: selected.includes(f.id), onChange: () => onToggle(f.id) }), _jsxs("span", { className: "grow", children: [_jsx("b", { children: f.name }), _jsxs("small", { children: [(f.size / 1024 / 1024).toFixed(1), " MB"] })] }), _jsx("button", { className: "icon-btn", "aria-label": "Sil", onClick: () => onRemove(f), children: _jsx(Icon, { name: "trash", size: 18 }) })] }, f.id))) }), _jsx("input", { ref: input, type: "file", accept: "audio/*", multiple: true, hidden: true, onChange: (e) => (onImport(e.target.files), (e.target.value = '')) }), _jsxs("button", { className: "btn btn-ghost btn-sm", onClick: () => input.current?.click(), children: [_jsx(Icon, { name: "plus", size: 16 }), " Dosya ekle"] })] }));
}
