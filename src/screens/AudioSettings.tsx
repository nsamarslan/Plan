import { useEffect, useRef, useState } from 'react';
import { addAudio, deleteAudio, listAudio, type AudioKind, type AudioMeta } from '../audio/db';
import { setAudioTest, useAudioTest } from '../audio/controller';
import { previewCue } from '../audio/engine';
import { Icon, NumberInput, Segmented, Switch } from '../components/ui';
import { uid } from '../model/schedule';
import type { AudioSettings } from '../model/types';
import { isNative, PlanNative, type VoiceInfo } from '../native/plan';
import { updateSettings, useAppState } from '../store/store';

const LANGS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'tr-TR', label: 'Türkçe' },
];

function useVoices(lang: string): VoiceInfo[] {
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  useEffect(() => {
    if (isNative) {
      PlanNative.listVoices()
        .then((r) => setVoices(r.voices))
        .catch(() => {});
      return;
    }
    const synth = window.speechSynthesis;
    if (!synth) return;
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
  const set = (patch: Partial<AudioSettings>) => updateSettings((x) => ({ ...x, audio: { ...x.audio, ...patch } }));
  const [files, setFiles] = useState<AudioMeta[]>([]);
  const [newPhrase, setNewPhrase] = useState('');
  const testing = useAudioTest();
  // Leaving Ayarlar ends the test.
  useEffect(() => () => setAudioTest(false), []);
  const voices = useVoices(a.lang);
  const refresh = () => void listAudio().then(setFiles);
  useEffect(refresh, []);

  const music = files.filter((f) => f.kind === 'music');
  const clips = files.filter((f) => f.kind === 'voice');

  const onImport = async (list: FileList | null, kind: AudioKind) => {
    if (!list) return;
    const added: AudioMeta[] = [];
    for (const f of Array.from(list)) added.push(await addAudio(f, kind));
    if (kind === 'music') set({ musicIds: [...a.musicIds, ...added.map((x) => x.id)], musicEnabled: true });
    else set({ clipIds: [...a.clipIds, ...added.map((x) => x.id)] });
    refresh();
  };
  const remove = async (f: AudioMeta) => {
    await deleteAudio(f.id);
    set({ musicIds: a.musicIds.filter((x) => x !== f.id), clipIds: a.clipIds.filter((x) => x !== f.id) });
    refresh();
  };
  const toggleIn = (key: 'musicIds' | 'clipIds', id: string) =>
    set({ [key]: a[key].includes(id) ? a[key].filter((x) => x !== id) : [...a[key], id] } as Partial<AudioSettings>);

  return (
    <div className="card">
      <div className="card-h">
        <h2>Sesli odak</h2>
      </div>
      <p className="muted">
        Arka planda müzik çalar, arada bir dikkatini geri çağıran bir cümle söylenir. Ses dosyaları bu cihazda saklanır.
      </p>
      <Switch label="Sesli komutlar" checked={a.voiceEnabled} onChange={(v) => set({ voiceEnabled: v })} />
      <Switch label="Arka plan müziği" checked={a.musicEnabled} onChange={(v) => set({ musicEnabled: v })} />
      <div className="field">
        <span>Ne zaman çalsın</span>
        <Segmented
          options={[
            { value: 'focusBlocks', label: 'Sesli odak bloklarında' },
            { value: 'always', label: 'Uygulama açıkken' },
          ]}
          value={a.when}
          onChange={(v) => set({ when: v })}
        />
        <span className="muted">"Sesli odak blokları": DSA, System Design, AI uygulaması (Plan → Blok türleri'nden değiştir). Blok başlayınca çalar.</span>
      </div>

      <div className="grid2">
        <label className="field">
          <span>En az aralık (dk)</span>
          <NumberInput decimals min={0.25} max={240} step={0.5} value={a.minSec / 60} onChange={(v) => v !== undefined && set({ minSec: Math.round(v * 60) })} />
        </label>
        <label className="field">
          <span>En çok aralık (dk)</span>
          <NumberInput decimals min={0.25} max={240} step={0.5} value={a.maxSec / 60} onChange={(v) => v !== undefined && set({ maxSec: Math.round(v * 60) })} />
        </label>
      </div>

      <label className="field">
        <span>Müzik sesi</span>
        <input type="range" min={0} max={1} step={0.05} value={a.musicVolume} onChange={(e) => set({ musicVolume: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span>Konuşma sesi</span>
        <input type="range" min={0} max={1} step={0.05} value={a.voiceVolume} onChange={(e) => set({ voiceVolume: Number(e.target.value) })} />
      </label>

      <div className="grid2">
        <label className="field">
          <span>Dil</span>
          <select className="input" value={a.lang} onChange={(e) => set({ lang: e.target.value, voiceName: '' })}>
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ses</span>
          <select className="input" value={a.voiceName} onChange={(e) => set({ voiceName: e.target.value })}>
            <option value="">Varsayılan</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid2">
        <label className="field">
          <span>Hız {a.rate.toFixed(2)}</span>
          <input type="range" min={0.5} max={1.5} step={0.05} value={a.rate} onChange={(e) => set({ rate: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Ton {a.pitch.toFixed(2)}</span>
          <input type="range" min={0.5} max={1.5} step={0.05} value={a.pitch} onChange={(e) => set({ pitch: Number(e.target.value) })} />
        </label>
      </div>
      <div className="row-wrap">
        <button className="btn btn-sm" onClick={() => void previewCue(a, 'DSA')}>
          <Icon name="play" size={16} /> Bir cümle dinle
        </button>
        <button
          className="btn btn-sm"
          onClick={() => setAudioTest(!testing)}
        >
          <Icon name={testing ? 'stop' : 'play'} size={16} /> {testing ? 'Testi durdur' : 'Hepsini test et'}
        </button>
      </div>

      <div className="field">
        <span>Cümleler ({a.phrases.filter((p) => p.enabled).length} açık) — {'{block}'} o anki bloğun adı olur</span>
        <div className="list">
          {a.phrases.map((p) => (
            <div key={p.id} className="list-row">
              <input
                type="checkbox"
                className="toggle"
                checked={p.enabled}
                onChange={(e) => set({ phrases: a.phrases.map((x) => (x.id === p.id ? { ...x, enabled: e.target.checked } : x)) })}
              />
              <input
                className="input grow"
                value={p.text}
                onChange={(e) => set({ phrases: a.phrases.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)) })}
              />
              <button className="icon-btn" aria-label="Sil" onClick={() => set({ phrases: a.phrases.filter((x) => x.id !== p.id) })}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newPhrase.trim()) return;
            set({ phrases: [...a.phrases, { id: uid('p'), text: newPhrase.trim(), enabled: true }] });
            setNewPhrase('');
          }}
        >
          <input className="input" placeholder="Yeni cümle…" value={newPhrase} onChange={(e) => setNewPhrase(e.target.value)} />
          <button className="btn" type="submit">
            Ekle
          </button>
        </form>
      </div>

      <AudioFileList
        title="Müzik dosyaları (seçililer sırayla çalar, tek dosya kesintisiz döner)"
        files={music}
        selected={a.musicIds}
        onToggle={(id) => toggleIn('musicIds', id)}
        onRemove={remove}
        onImport={(fl) => void onImport(fl, 'music')}
      />
      <AudioFileList
        title="Ses kayıtları (cümlelerin arasında rastgele çalar)"
        files={clips}
        selected={a.clipIds}
        onToggle={(id) => toggleIn('clipIds', id)}
        onRemove={remove}
        onImport={(fl) => void onImport(fl, 'voice')}
      />
    </div>
  );
}

function AudioFileList({
  title,
  files,
  selected,
  onToggle,
  onRemove,
  onImport,
}: {
  title: string;
  files: AudioMeta[];
  selected: string[];
  onToggle: (id: string) => void;
  onRemove: (f: AudioMeta) => void;
  onImport: (f: FileList | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <span>{title}</span>
      <div className="list">
        {files.map((f) => (
          <div key={f.id} className="list-row">
            <input type="checkbox" className="toggle" checked={selected.includes(f.id)} onChange={() => onToggle(f.id)} />
            <span className="grow">
              <b>{f.name}</b>
              <small>{(f.size / 1024 / 1024).toFixed(1)} MB</small>
            </span>
            <button className="icon-btn" aria-label="Sil" onClick={() => onRemove(f)}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
      </div>
      <input ref={input} type="file" accept="audio/*" multiple hidden onChange={(e) => (onImport(e.target.files), (e.target.value = ''))} />
      <button className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}>
        <Icon name="plus" size={16} /> Dosya ekle
      </button>
    </div>
  );
}
