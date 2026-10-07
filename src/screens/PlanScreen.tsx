import { useMemo, useState } from 'react';
import { artUrl, Chips, cssVars, Icon, Sheet, Switch, TimeInput } from '../components/ui';
import { AppPicker } from '../components/AppPicker';
import { addDays, ALL_DAYS, dateKey, fmtDuration, WEEK_ORDER, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekday } from '../lib/time';
import { resolveDay, uid } from '../model/schedule';
import type { ArtKey, BlockMode, BlockType, TemplateItem } from '../model/types';
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
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editType, setEditType] = useState<string | null>(null);
  const total = items.filter((i) => i.type.tracked).reduce((n, i) => n + i.duration, 0);
  const editItem = s.template.find((t) => t.id === editing);

  return (
    <div className="page">
      <div className="page-h">
        <h1>Plan</h1>
      </div>
      <p className="sub">
        Her günün varsayılan planı. Bugünü değiştirmek için "Bugün" sekmesini kullan — buradaki değişiklikler her hafta tekrar eder.
      </p>

      <div className="card">
        <div className="grid2">
          <label className="field">
            <span>Kalkış</span>
            <TimeInput value={s.settings.wake} onChange={(v) => updateSettings((x) => ({ ...x, wake: v }))} />
          </label>
          <label className="field">
            <span>Yatış</span>
            <TimeInput value={s.settings.sleep} onChange={(v) => updateSettings((x) => ({ ...x, sleep: v }))} />
          </label>
        </div>
        <p className="muted">
          Uyku: {fmtDuration((s.settings.wake - s.settings.sleep + 24 * 60) % (24 * 60))}. Her gün aynı saatte kalk.
        </p>
      </div>

      <div className="row-wrap">
        {WEEK_ORDER.map((d) => (
          <button key={d} className="chip" aria-pressed={d === wd} onClick={() => setWd(d)}>
            {WEEKDAYS_SHORT[d]}
          </button>
        ))}
      </div>
      <p className="sub">
        {WEEKDAYS_LONG[wd]}: {items.filter((i) => i.type.tracked).length} blok · {fmtDuration(total)}
      </p>
      <Timeline items={items} date={sample} now={0} onPick={setEditing} />
      <button className="btn btn-ghost" onClick={() => setAdding(true)}>
        <Icon name="plus" /> Plana blok ekle
      </button>

      <div className="card">
        <div className="card-h">
          <h2>Blok türleri</h2>
        </div>
        <p className="muted">Her türün bildirimi, resmi, ilk adımı ve odak ayarı sabittir; sadece saati değişir.</p>
        <div className="list">
          {s.typeOrder.map((id) => {
            const t = s.types[id];
            return (
              <button key={id} className="list-row" style={{ background: 'none', border: 0, textAlign: 'left', ...cssVars({ '--c': t.color }) }} onClick={() => setEditType(id)}>
                <img className="tl-thumb" src={artUrl(t.art)} alt="" />
                <span className="grow">
                  <b>{t.name}</b>
                  <small>
                    {t.dnd ? 'Odak modu · ' : ''}
                    {t.focusAudio ? 'Sesli odak · ' : ''}
                    {t.firstStep}
                  </small>
                </span>
                <Icon name="edit" size={18} />
              </button>
            );
          })}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
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
          }}
        >
          <Icon name="plus" size={16} /> Yeni blok türü
        </button>
      </div>

      {editItem && <TemplateItemSheet item={editItem} onClose={() => setEditing(null)} />}
      {adding && (
        <AddBlockSheet
          types={s.typeOrder.map((id) => s.types[id])}
          onClose={() => setAdding(false)}
          onPick={(t) => {
            const id = uid('t');
            const lastEnd = items.length ? Math.max(...items.map((i) => i.end)) : s.settings.wake;
            updateTemplate((list) => [...list, { id, typeId: t.id, start: Math.min(lastEnd, s.settings.sleep - 30), duration: 30, days: [...ALL_DAYS] }]);
            setAdding(false);
            setEditing(id);
          }}
        />
      )}
      {editType && s.types[editType] && <TypeSheet type={s.types[editType]} onClose={() => setEditType(null)} />}
    </div>
  );
}

function TemplateItemSheet({ item, onClose }: { item: TemplateItem; onClose: () => void }) {
  const s = useAppState();
  const type = s.types[item.typeId];
  const upd = (patch: Partial<TemplateItem>) => updateTemplate((list) => list.map((t) => (t.id === item.id ? { ...t, ...patch } : t)));
  return (
    <Sheet
      title={
        <span className="row" style={cssVars({ '--c': type?.color })}>
          <span className="color-dot" /> {item.label || type?.name}
        </span>
      }
      onClose={onClose}
    >
      <label className="field">
        <span>İsim (boş: {type?.name})</span>
        <input className="input" value={item.label ?? ''} onChange={(e) => upd({ label: e.target.value || undefined })} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>Başlangıç</span>
          <TimeInput value={item.start} onChange={(v) => upd({ start: v })} />
        </label>
        <label className="field">
          <span>Süre (dk)</span>
          <input
            className="input num"
            type="number"
            min={5}
            step={5}
            value={item.duration}
            onChange={(e) => upd({ duration: Math.max(5, Number(e.target.value) || 5) })}
          />
        </label>
      </div>
      <div className="field">
        <span>Günler</span>
        <Chips
          options={dayOptions}
          value={item.days}
          onToggle={(d) => upd({ days: item.days.includes(d) ? item.days.filter((x) => x !== d) : [...item.days, d] })}
        />
      </div>
      <Switch
        label="Odak modu"
        hint={`Varsayılan: ${type?.dnd ? 'açık' : 'kapalı'} (blok türünden)`}
        checked={item.dnd ?? type?.dnd ?? false}
        onChange={(v) => upd({ dnd: v })}
      />
      <Switch label="Kötü gün modunda da kalsın" checked={!!item.minimal} onChange={(v) => upd({ minimal: v })} />
      {item.minimal && (
        <label className="field">
          <span>Kötü gün süresi (dk, boş: aynı)</span>
          <input
            className="input num"
            type="number"
            min={5}
            step={5}
            value={item.minimalDuration ?? ''}
            onChange={(e) => upd({ minimalDuration: Number(e.target.value) || undefined })}
          />
        </label>
      )}
      <button
        className="btn btn-danger"
        onClick={() => {
          updateTemplate((list) => list.filter((t) => t.id !== item.id));
          onClose();
        }}
      >
        <Icon name="trash" size={16} /> Plandan sil
      </button>
    </Sheet>
  );
}

const ARTS: ArtKey[] = ['tilt', 'walk', 'weights', 'reading', 'meditation', 'dsa', 'design', 'ai', 'review', 'meal', 'free', 'sleep'];
const MODES: { value: BlockMode; label: string }[] = [
  { value: 'timer', label: 'Sayaç' },
  { value: 'pomodoro', label: 'Pomodoro (50/10)' },
  { value: 'walk', label: 'Yürüyüş (yarıda dönüş)' },
  { value: 'meditation', label: 'Meditasyon (nefes)' },
  { value: 'tilt', label: 'Pelvis rehberi' },
];

function TypeSheet({ type, onClose }: { type: BlockType; onClose: () => void }) {
  const upd = (patch: Partial<BlockType>) => updateType(type.id, (t) => ({ ...t, ...patch }));
  return (
    <Sheet title={type.name} onClose={onClose}>
      <label className="field">
        <span>İsim</span>
        <input className="input" value={type.name} onChange={(e) => upd({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>İlk adım (bildirimde ve ekranda yazar)</span>
        <textarea className="input" value={type.firstStep} onChange={(e) => upd({ firstStep: e.target.value })} />
      </label>
      <label className="field">
        <span>Sıradaki (bir dahaki sefere ne yapacaksın)</span>
        <input className="input" value={type.note} onChange={(e) => upd({ note: e.target.value })} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>Renk</span>
          <input className="input" type="color" value={type.color} onChange={(e) => upd({ color: e.target.value })} />
        </label>
        <label className="field">
          <span>Ekran</span>
          <select className="input" value={type.mode} onChange={(e) => upd({ mode: e.target.value as BlockMode })}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field">
        <span>Resim</span>
        <div className="type-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
          {ARTS.map((a) => (
            <button
              key={a}
              className="type-card"
              style={cssVars({ '--c': a === type.art ? type.color : 'transparent', outline: a === type.art ? `2px solid ${type.color}` : 'none' })}
              onClick={() => upd({ art: a })}
            >
              <img src={artUrl(a)} alt={a} />
            </button>
          ))}
        </div>
      </div>
      <Switch label="Odak modu (varsayılan)" hint="Bildirimler susar, aramalar gelir, diğer uygulamalar kilitlenir." checked={type.dnd} onChange={(v) => upd({ dnd: v })} />
      <Switch label="Bildirimler" hint="5 dk önce, başlangıçta, başlamazsan tekrar, bitişte." checked={type.notify} onChange={(v) => upd({ notify: v })} />
      <Switch label="Sesli odak" hint="Bu blokta arka plan müziği ve sesli komutlar çalar." checked={type.focusAudio} onChange={(v) => upd({ focusAudio: v })} />
      <Switch label="Takipte say" checked={type.tracked} onChange={(v) => upd({ tracked: v })} />
      {isNative && (
        <div className="field">
          <span>Bu blokta kilit açık kalacak uygulamalar</span>
          <AppPicker value={type.allowedApps} onChange={(v) => upd({ allowedApps: v })} />
        </div>
      )}
    </Sheet>
  );
}
