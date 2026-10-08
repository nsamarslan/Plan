import { useEffect, useRef, useState } from 'react';
import { AppPicker } from '../components/AppPicker';
import { Chips, HoldButton, Icon, Switch, TimeInput } from '../components/ui';
import { dateKey, fmt, WEEK_ORDER, WEEKDAYS_SHORT } from '../lib/time';
import { uid } from '../model/schedule';
import type { DndRange, Settings } from '../model/types';
import { BUILTIN_ALLOWED, isNative, PlanNative, type PermissionName, type PermissionState } from '../native/plan';
import { toast } from '../services/toast';
import { allDocKeys, applyRemote, getDoc, resetAll, updateSettings, useAppState } from '../store/store';
import { fullSync, initSync, signIn, signOut, signUp, useSyncStatus } from '../store/sync';
import { AudioSettingsCard } from './AudioSettings';

const dayOptions = WEEK_ORDER.map((d) => ({ value: d, label: WEEKDAYS_SHORT[d] }));
const set = (patch: Partial<Settings>) => updateSettings((x) => ({ ...x, ...patch }));

export function SettingsScreen() {
  const s = useAppState().settings;
  return (
    <div className="page">
      <div className="page-h">
        <h1>Ayarlar</h1>
      </div>
      {isNative && <PermissionsCard />}
      <FocusCard />
      <AudioSettingsCard />
      <NotifyCard />
      <div className="card">
        <h2>Pelvis programı</h2>
        <label className="field">
          <span>Başlangıç günü (8 hafta buradan sayılır)</span>
          <input className="input" type="date" value={s.tiltStartDate} onChange={(e) => e.target.value && set({ tiltStartDate: e.target.value })} />
        </label>
        <button className="btn btn-ghost btn-sm" onClick={() => set({ tiltStartDate: dateKey(new Date()) })}>
          Bugünden yeniden başlat
        </button>
      </div>
      <div className="card">
        <h2>Takip</h2>
        <Switch
          label="Seri (streak) göster"
          hint="Bloklarının %80'ini yaptığın art arda gün sayısı. Bozulunca moral bozuyorsa kapalı tut."
          checked={s.showStreak}
          onChange={(v) => set({ showStreak: v })}
        />
      </div>
      <SyncCard />
      <DataCard />
      <p className="muted" style={{ textAlign: 'center' }}>
        Plan · v0.1
      </p>
    </div>
  );
}

function NotifyCard() {
  const s = useAppState().settings;
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  return (
    <div className="card">
      <h2>Bildirimler</h2>
      <div className="grid2">
        <label className="field">
          <span>Önceden uyar (dk)</span>
          <input className="input num" type="number" min={0} max={30} value={s.preWarnMin} onChange={(e) => set({ preWarnMin: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="field">
          <span>Başlamazsan tekrar (dk)</span>
          <input className="input num" type="number" min={1} max={30} value={s.remindEveryMin} onChange={(e) => set({ remindEveryMin: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
      </div>
      <label className="field">
        <span>Kaç kez tekrar etsin</span>
        <input className="input num" type="number" min={0} max={10} value={s.remindCount} onChange={(e) => set({ remindCount: Math.max(0, Number(e.target.value) || 0) })} />
      </label>
      {!isNative && perm !== 'granted' && typeof Notification !== 'undefined' && (
        <button className="btn btn-primary" onClick={() => void Notification.requestPermission().then(setPerm)}>
          Tarayıcı bildirimlerine izin ver
        </button>
      )}
      {!isNative && <p className="muted">Web'de bildirimler sadece bu sekme açıkken gelir. Asıl bildirimler Android uygulamasında.</p>}
    </div>
  );
}

function FocusCard() {
  const s = useAppState().settings;
  const updRange = (id: string, patch: Partial<DndRange>) => set({ dndRanges: s.dndRanges.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  return (
    <div className="card">
      <h2>Odak modu (Rahatsız Etmeyin)</h2>
      <p className="muted">
        Odak modunda bildirimler susar; telefon ve WhatsApp aramaları gelmeye devam eder. Uygulama kilidi açıksa sadece bu uygulama, arama ekranları ve izin verdiğin
        uygulamalar açılır.
      </p>
      <Switch
        label="Odak bloklarında uygulamaları da kilitle"
        hint="Kapalıysa sadece bildirimler susar."
        checked={s.lockAppsInDndBlocks}
        onChange={(v) => set({ lockAppsInDndBlocks: v })}
      />
      <div className="field">
        <span>Sabit saat aralıkları</span>
        <div className="list">
          {s.dndRanges.map((r) => (
            <div key={r.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
              <div className="row">
                <input className="input" value={r.label} onChange={(e) => updRange(r.id, { label: e.target.value })} />
                <input type="checkbox" className="toggle" checked={r.enabled} onChange={(e) => updRange(r.id, { enabled: e.target.checked })} aria-label="Açık" />
              </div>
              <div className="grid2">
                <TimeInput value={r.start} onChange={(v) => updRange(r.id, { start: v })} />
                <TimeInput value={r.end} onChange={(v) => updRange(r.id, { end: v })} />
              </div>
              <Chips
                options={dayOptions}
                value={r.days}
                onToggle={(d) => updRange(r.id, { days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] })}
              />
              <Switch label="Bildirimleri sustur" checked={r.silence} onChange={(v) => updRange(r.id, { silence: v })} />
              <Switch label="Uygulamaları kilitle" checked={r.lockApps} onChange={(v) => updRange(r.id, { lockApps: v })} />
              <button className="btn btn-danger btn-sm" onClick={() => set({ dndRanges: s.dndRanges.filter((x) => x.id !== r.id) })}>
                <Icon name="trash" size={16} /> Aralığı sil
              </button>
            </div>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            set({
              dndRanges: [
                ...s.dndRanges,
                { id: uid('r'), label: 'Odak', start: 9 * 60, end: 12 * 60, days: [1, 2, 3, 4, 5], silence: true, lockApps: true, enabled: true },
              ],
            })
          }
        >
          <Icon name="plus" size={16} /> Aralık ekle
        </button>
      </div>
      <div className="field">
        <span>Kilitliyken de açılabilen uygulamalar</span>
        <p className="muted">Her zaman açık: {BUILTIN_ALLOWED.join(', ')}.</p>
        {isNative ? <AppPicker value={s.allowedApps} onChange={(v) => set({ allowedApps: v })} /> : <p className="muted">Uygulama seçimi Android'de.</p>}
      </div>
      {isNative && <UnlockRow />}
    </div>
  );
}

function UnlockRow() {
  const [state, setState] = useState<{ active: boolean; label?: string; endsAt?: number }>({ active: false });
  useEffect(() => {
    const load = () => void PlanNative.getFocusState().then(setState).catch(() => {});
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);
  if (!state.active) return <p className="muted">Şu an odak modu kapalı.</p>;
  return (
    <div className="field">
      <span>
        Şu an açık: {state.label} {state.endsAt ? `· ${fmt(new Date(state.endsAt).getHours() * 60 + new Date(state.endsAt).getMinutes())}'e kadar` : ''}
      </span>
      <HoldButton
        onDone={() =>
          void PlanNative.unlockFocus().then(() => {
            toast({ title: 'Odak modu kapatıldı', body: 'Bu bloğun sonuna kadar kilit yok.' });
            setState({ active: false });
          })
        }
      >
        Acil durum: kilidi açmak için 5 sn basılı tut
      </HoldButton>
    </div>
  );
}

const PERMS: { name: PermissionName; label: string; why: string }[] = [
  { name: 'notifications', label: 'Bildirimler', why: 'Blok başlangıç ve hatırlatmaları' },
  { name: 'exactAlarm', label: 'Tam zamanlı alarm', why: 'Bildirimlerin dakikasında gelmesi' },
  { name: 'fullScreen', label: 'Tam ekran bildirim', why: 'Blok başlayınca kilit ekranında resmi göstermek' },
  { name: 'dnd', label: 'Rahatsız Etmeyin erişimi', why: 'Odak modunda bildirimleri susturmak' },
  { name: 'usage', label: 'Kullanım erişimi', why: 'Hangi uygulamanın açık olduğunu görüp kilitlemek' },
  { name: 'overlay', label: 'Diğer uygulamaların üzerinde göster', why: 'Kilitli uygulamanın üstüne odak ekranı koymak' },
  { name: 'battery', label: 'Pil optimizasyonu dışı', why: 'Android uygulamayı uyutmasın' },
];

function PermissionsCard() {
  const [p, setP] = useState<PermissionState | null>(null);
  const refresh = () => void PlanNative.getPermissions().then(setP).catch(() => {});
  useEffect(() => {
    refresh();
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  if (!p) return null;
  const missing = PERMS.filter((x) => !p[x.name]);
  return (
    <div className="card" style={missing.length ? { borderColor: 'var(--warn)' } : undefined}>
      <div className="card-h">
        <h2>İzinler</h2>
        {missing.length ? <span className="perm-no">{missing.length} eksik</span> : <span className="perm-ok">Hepsi tamam</span>}
      </div>
      <div className="list">
        {PERMS.map((x) => (
          <div key={x.name} className="list-row">
            <span className="grow">
              <b>{x.label}</b>
              <small>{x.why}</small>
            </span>
            {p[x.name] ? (
              <span className="perm-ok">✓</span>
            ) : (
              <button className="btn btn-sm btn-primary" onClick={() => void PlanNative.requestPermission({ name: x.name }).then(refresh)}>
                Aç
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncCard() {
  const st = useSyncStatus();
  const s = useAppState().settings;
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [url, setUrl] = useState(s.supabaseUrl ?? '');
  const [key, setKey] = useState(s.supabaseKey ?? '');
  const envConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  return (
    <div className="card">
      <div className="card-h">
        <h2>Senkron (telefon ↔ web)</h2>
        <span className={st.state === 'error' ? 'perm-no' : 'perm-ok'}>
          {st.state === 'syncing' ? 'Senkronlanıyor…' : st.state === 'error' ? 'Hata' : st.user ? 'Açık' : ''}
        </span>
      </div>
      {!st.configured && (
        <>
          <p className="muted">Supabase projesinin adresini ve "anon public" anahtarını gir (README'de 5 adımlık kurulum var).</p>
          <input className="input" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="input" placeholder="anon public key" value={key} onChange={(e) => setKey(e.target.value)} />
          <button
            className="btn btn-primary"
            onClick={() => {
              set({ supabaseUrl: url.trim(), supabaseKey: key.trim() });
              setTimeout(() => initSync(), 50);
            }}
          >
            Kaydet
          </button>
        </>
      )}
      {st.configured && !st.user && (
        <form
          className="field"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg((await signIn(email, pw)) ?? '');
          }}
        >
          <input className="input" type="email" placeholder="E-posta" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Şifre" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <div className="row">
            <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
              Giriş yap
            </button>
            <button className="btn" type="button" style={{ flex: 1 }} onClick={async () => setMsg((await signUp(email, pw)) ?? '')}>
              Hesap oluştur
            </button>
          </div>
          {msg && <p className="muted">{msg}</p>}
        </form>
      )}
      {st.user && (
        <>
          <p className="sub">
            {st.user.email} · {st.lastSync ? `son: ${new Date(st.lastSync).toLocaleTimeString('tr-TR')}` : ''}
          </p>
          {st.error && <p className="perm-no">{st.error}</p>}
          <div className="row">
            <button className="btn btn-sm" onClick={() => void fullSync()}>
              Şimdi senkronla
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => void signOut()}>
              Çıkış
            </button>
          </div>
        </>
      )}
      {st.configured && !envConfigured && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            set({ supabaseUrl: undefined, supabaseKey: undefined });
            location.reload();
          }}
        >
          Supabase ayarını sıfırla
        </button>
      )}
    </div>
  );
}

function DataCard() {
  const file = useRef<HTMLInputElement>(null);
  const exportData = () => {
    const docs = Object.fromEntries(allDocKeys().map((k) => [k, getDoc(k)]));
    const blob = new Blob([JSON.stringify({ app: 'plan', v: 1, docs }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plan-yedek-${dateKey(new Date())}.json`;
    a.click();
  };
  const importData = async (f: File | undefined) => {
    if (!f) return;
    try {
      const json = JSON.parse(await f.text()) as { docs: Record<string, { data: unknown; updatedAt: number }> };
      let n = 0;
      for (const [k, env] of Object.entries(json.docs)) if (env && applyRemote(k, env.data, Math.max(env.updatedAt, Date.now()))) n++;
      toast({ title: 'Yedek yüklendi', body: `${n} kayıt` });
      void fullSync();
    } catch {
      toast({ title: 'Dosya okunamadı' });
    }
  };
  return (
    <div className="card">
      <h2>Veri</h2>
      <div className="row-wrap">
        <button className="btn btn-sm" onClick={exportData}>
          Yedek indir
        </button>
        <button className="btn btn-sm" onClick={() => file.current?.click()}>
          Yedek yükle
        </button>
        <input ref={file} type="file" accept="application/json" hidden onChange={(e) => void importData(e.target.files?.[0])} />
      </div>
      <HoldButton
        ms={3000}
        onDone={() => {
          resetAll();
          toast({ title: 'Bu cihazdaki veriler sıfırlandı' });
        }}
      >
        Bu cihazdaki her şeyi sıfırla (3 sn basılı tut)
      </HoldButton>
    </div>
  );
}
