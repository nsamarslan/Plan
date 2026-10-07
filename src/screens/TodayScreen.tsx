import { useMemo, useState } from 'react';
import { artUrl, cssVars, Icon, Segmented, Sheet, Switch, TimeInput } from '../components/ui';
import { addDays, dateKey, fmt, fmtDateLong, fmtDuration, minutesOfDay } from '../lib/time';
import {
  addExtra,
  clearOverride,
  effectiveStatus,
  finishItem,
  moveItem,
  removeItem,
  resetItem,
  resolveDay,
  setDuration,
  skipItem,
  startItem,
  uid,
} from '../model/schedule';
import { dayStats, pct } from '../model/stats';
import type { BlockType, DayDoc, EffectiveStatus, ResolvedItem } from '../model/types';
import { updateDay, updateTemplate, useAppState } from '../store/store';

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  upcoming: '',
  late: 'Bekliyor',
  active: 'Şimdi',
  done: 'Tamam',
  skipped: 'Atlandı',
  missed: 'Kaçtı',
};

export function TodayScreen({ now }: { now: number }) {
  const s = useAppState();
  const today = dateKey(new Date(now));
  const [which, setWhich] = useState<'today' | 'tomorrow'>(() => (minutesOfDay(new Date()) >= 20 * 60 ? 'tomorrow' : 'today'));
  const date = which === 'today' ? today : addDays(today, 1);
  const day = s.days[date];
  const items = useMemo(() => resolveDay(date, s.template, s.types, day), [date, s.template, s.types, day]);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const st = dayStats(date, items, now);
  const minimal = day?.mode === 'minimal';
  const editItem = items.find((i) => i.id === editing);

  return (
    <div className="page">
      <div className="page-h">
        <h1>{which === 'today' ? 'Bugün' : 'Yarın'}</h1>
        <Segmented
          options={[
            { value: 'today', label: 'Bugün' },
            { value: 'tomorrow', label: 'Yarın' },
          ]}
          value={which}
          onChange={setWhich}
        />
      </div>
      <p className="sub">
        {fmtDateLong(date)} · {st.done}/{st.planned} blok · %{pct(st.done, st.planned)}
      </p>

      <div className="card">
        <Switch
          label="Kötü gün modu"
          hint="Sadece temel bloklar kalır: pelvis, sabah yürüyüşü, 1 saat DSA. Hiç yapmamaktan iyidir."
          checked={minimal}
          onChange={(v) => updateDay(date, (d) => ({ ...d, mode: v ? 'minimal' : 'normal' }))}
        />
      </div>

      <Timeline items={items} date={date} now={now} onPick={setEditing} />

      <button className="btn btn-ghost" onClick={() => setAdding(true)}>
        <Icon name="plus" /> Bu güne blok ekle
      </button>

      {editItem && <ItemSheet item={editItem} items={items} date={date} onClose={() => setEditing(null)} />}
      {adding && (
        <AddBlockSheet
          types={s.typeOrder.map((id) => s.types[id])}
          onClose={() => setAdding(false)}
          onPick={(t) => {
            const lastEnd = items.length ? Math.max(...items.map((i) => i.end)) : s.settings.wake;
            const nowMin = Math.ceil(minutesOfDay(new Date()) / 5) * 5;
            const start = which === 'today' ? Math.max(nowMin, Math.min(lastEnd, s.settings.sleep - 30)) : s.settings.wake;
            const id = uid('e');
            updateDay(date, (d) => addExtra(d, { id, typeId: t.id, start, duration: 30, days: [] }));
            setAdding(false);
            setEditing(id);
          }}
        />
      )}
    </div>
  );
}

export function Timeline({
  items,
  date,
  now,
  onPick,
}: {
  items: ResolvedItem[];
  date: string;
  now: number;
  onPick: (id: string) => void;
}) {
  return (
    <div className="tl">
      {items.map((it, i) => {
        const st = effectiveStatus(it, date, now);
        const prev = items[i - 1];
        const gap = prev ? it.start - prev.end : 0;
        const isNow = st === 'active' || st === 'late';
        return (
          <div key={it.id} style={{ display: 'contents' }}>
            {gap >= 10 && <div className="tl-gap">· serbest {fmtDuration(gap)}</div>}
            {gap < 0 && <div className="tl-gap" style={{ color: 'var(--warn)' }}>· {fmtDuration(-gap)} çakışma</div>}
            <button
              className={`tl-item ${isNow ? 'is-now' : ''} ${st === 'skipped' || (!it.type.tracked && st === 'missed') ? 'is-dim' : ''}`}
              style={cssVars({ '--c': it.type.color })}
              onClick={() => onPick(it.id)}
            >
              <span className="tl-time num">
                {fmt(it.start)}
                <small>{fmt(it.end)}</small>
              </span>
              <span className="tl-bar" />
              <span>
                <span className="tl-name">
                  {it.label}
                  {it.dnd && <Icon name="lock" />}
                </span>
                <span className="tl-meta">
                  {fmtDuration(it.duration)}
                  {it.moved ? ' · kaydırıldı' : ''}
                  {it.extra ? ' · sadece bu gün' : ''}
                </span>
              </span>
              {STATUS_LABEL[st] ? <span className={`status st-${st}`}>{STATUS_LABEL[st]}</span> : <span />}
            </button>
          </div>
        );
      })}
      {!items.length && <p className="muted">Bu gün için blok yok.</p>}
    </div>
  );
}

function Stepper({ value, onChange, step = 15, render }: { value: number; onChange: (v: number) => void; step?: number; render: React.ReactNode }) {
  return (
    <div className="stepper">
      <button className="btn" onClick={() => onChange(value - step)}>
        −{step}
      </button>
      <div style={{ flex: 1 }}>{render}</div>
      <button className="btn" onClick={() => onChange(value + step)}>
        +{step}
      </button>
    </div>
  );
}

function ItemSheet({ item, items, date, onClose }: { item: ResolvedItem; items: ResolvedItem[]; date: string; onClose: () => void }) {
  const s = useAppState();
  const today = dateKey(new Date());
  const st = effectiveStatus(item, date, Date.now());
  const tpl = s.template.find((t) => t.id === item.id);
  const upd = (fn: (d: DayDoc) => DayDoc) => updateDay(date, fn);
  const move = (start: number) => upd((d) => moveItem(d, items, item.id, Math.max(0, Math.min(24 * 60 - 5, start))));

  const saveToTemplate = () => {
    if (!tpl) return;
    updateTemplate((list) => list.map((t) => (t.id === item.id ? { ...t, start: item.start, duration: item.duration, dnd: item.dnd } : t)));
    upd((d) => clearOverride(d, item.id));
  };

  return (
    <Sheet
      title={
        <span className="row" style={cssVars({ '--c': item.type.color })}>
          <span className="color-dot" /> {item.label}
        </span>
      }
      onClose={onClose}
    >
      <div className="field">
        <span>Başlangıç (sonraki bloklar gerekirse kayar)</span>
        <Stepper value={item.start} onChange={move} render={<TimeInput value={item.start} onChange={move} />} />
      </div>
      <div className="field">
        <span>Süre</span>
        <Stepper
          value={item.duration}
          onChange={(v) => upd((d) => setDuration(d, item.id, Math.max(5, v)))}
          render={<div className="input num" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{fmtDuration(item.duration)}</div>}
        />
      </div>
      <Switch
        label="Odak modu"
        hint="Bildirimler susar (aramalar gelir), diğer uygulamalar kilitlenir."
        checked={item.dnd}
        onChange={(v) => upd((d) => ({ ...d, overrides: { ...d.overrides, [item.id]: { ...d.overrides[item.id], dnd: v } } }))}
      />

      {date === today && (
        <div className="row-wrap">
          {st !== 'active' && st !== 'done' && (
            <button className="btn btn-primary" onClick={() => (upd((d) => startItem(d, items, item.id, Date.now())), onClose())}>
              Başladım
            </button>
          )}
          {st !== 'done' && (
            <button className="btn" onClick={() => (upd((d) => finishItem(d, item.id, Date.now())), onClose())}>
              <Icon name="check" /> Yaptım
            </button>
          )}
          {st !== 'skipped' && st !== 'done' && (
            <button className="btn" onClick={() => (upd((d) => skipItem(d, item.id)), onClose())}>
              Atla
            </button>
          )}
          {(st === 'done' || st === 'skipped' || st === 'active') && (
            <button className="btn btn-ghost" onClick={() => upd((d) => resetItem(d, item.id))}>
              Durumu sıfırla
            </button>
          )}
        </div>
      )}

      <div className="row-wrap">
        {item.moved && tpl && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={saveToTemplate}>
              Her gün böyle olsun
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => upd((d) => clearOverride(d, item.id))}>
              Plandaki saate dön
            </button>
          </>
        )}
        <span className="spacer" />
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            upd((d) => removeItem(d, item.id));
            onClose();
          }}
        >
          <Icon name="trash" size={16} /> {item.extra ? 'Sil' : 'Bu günden kaldır'}
        </button>
      </div>
    </Sheet>
  );
}

export function AddBlockSheet({ types, onPick, onClose }: { types: BlockType[]; onPick: (t: BlockType) => void; onClose: () => void }) {
  return (
    <Sheet title="Blok seç" onClose={onClose}>
      <div className="type-grid">
        {types.map((t) => (
          <button key={t.id} className="type-card" style={cssVars({ '--c': t.color })} onClick={() => onPick(t)}>
            <img src={artUrl(t.art)} alt="" />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

