import { useMemo, useState } from 'react';
import { setAudioMuted } from '../audio/controller';
import { TiltGuide } from '../components/TiltGuide';
import { artUrl, cssVars, Icon, Ring, Sheet } from '../components/ui';
import { useWakeLock } from '../hooks/useWakeLock';
import { addDays, dateKey, fmt, fmtClock, fmtDuration, minutesOfDay, msAt, MIN_MS } from '../lib/time';
import { DAILY_HABITS } from '../model/defaults';
import { activeFocus, buildFocusWindows } from '../model/notify';
import {
  finishItem,
  moveItem,
  nowState,
  pomodoroPhases,
  resolveDay,
  skipItem,
  START_GRACE_MIN,
  startItem,
} from '../model/schedule';
import { dayStats } from '../model/stats';
import { programDay } from '../model/tilt';
import type { ArtKey, EffectiveStatus, ResolvedItem } from '../model/types';
import { isNative } from '../native/plan';
import { planInput } from '../services/scheduler';
import { updateDay, updateType, useAppState } from '../store/store';

interface Props {
  now: number;
  onOpenToday: () => void;
  audio: { wanted: boolean; muted: boolean; key: string };
}

export function NowScreen({ now, onOpenToday, audio }: Props) {
  const s = useAppState();
  const today = dateKey(new Date(now));
  const items = useMemo(() => resolveDay(today, s.template, s.types, s.days[today]), [today, s.template, s.types, s.days]);
  const { current, currentStatus, next } = nowState(items, today, now);
  const nowMin = minutesOfDay(new Date(now));
  const stats = dayStats(today, items, now);
  const minuteKey = Math.floor(now / MIN_MS);
  const focus = useMemo(
    () => activeFocus(buildFocusWindows(planInput(minuteKey * MIN_MS)), now),
    [minuteKey, s],
  );
  useWakeLock(!!current);

  const asleep = !current && (nowMin < s.settings.wake || nowMin >= s.settings.sleep);
  const dayOver = !current && !next && !asleep;
  const tomorrowFirst = useMemo(() => {
    const date = nowMin >= s.settings.wake ? addDays(today, 1) : today;
    return resolveDay(date, s.template, s.types, s.days[date]).find((i) => i.type.tracked);
  }, [nowMin, s, today]);

  let art: ArtKey = 'free';
  let color = '#64748b';
  if (current) {
    art = current.type.art;
    color = current.type.color;
  } else if (asleep || dayOver) {
    art = 'sleep';
    color = '#6366f1';
  }

  const top = (
    <div className="now-top">
      <span className="now-clock num">{fmt(nowMin)}</span>
      <span className="pill num" title="Bugün tamamlanan bloklar">
        {stats.done}/{stats.planned}
      </span>
      {focus && (
        <span className="pill focus-pill">
          <Icon name="lock" /> {focus.label} · {fmt(minutesOfDay(new Date(focus.end)))}
        </span>
      )}
      <span className="spacer" />
      {audio.wanted && (
        <button
          className="icon-btn"
          aria-label={audio.muted ? 'Sesi aç' : 'Sesi kapat'}
          onClick={() => setAudioMuted(audio.muted ? null : audio.key)}
        >
          <Icon name={audio.muted ? 'mute' : 'sound'} />
        </button>
      )}
      {document.fullscreenEnabled && !isNative && window.innerWidth >= 700 && (
        <button
          className="icon-btn"
          aria-label="Tam ekran"
          onClick={() =>
            document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen()
          }
        >
          <Icon name="expand" />
        </button>
      )}
      <button className="icon-btn" aria-label="Günün planı" onClick={onOpenToday}>
        <Icon name="menu" />
      </button>
    </div>
  );

  return (
    <div className={`now ${current?.type.mode === 'tilt' && currentStatus === 'active' ? 'now--guide' : ''}`} style={cssVars({ '--c': color })}>
      <img className="now-art" src={artUrl(art)} alt="" />
      <div className="now-shade" />
      {top}
      <div className="now-body">
        {current ? (
          <Current item={current} status={currentStatus!} items={items} today={today} now={now} next={next} />
        ) : asleep || dayOver ? (
          <Sleep dayOver={dayOver} sleepAt={s.settings.sleep} first={tomorrowFirst} />
        ) : (
          <Free next={next} items={items} today={today} now={now} />
        )}
      </div>
    </div>
  );
}

function NextLine({ next }: { next?: ResolvedItem }) {
  if (!next) return null;
  return (
    <div className="now-next" style={cssVars({ '--nc': next.type.color })}>
      <i />
      <span>
        Sonra: <b className="num">{fmt(next.start)}</b> {next.label}
      </span>
    </div>
  );
}

function Current({
  item,
  status,
  items,
  today,
  now,
  next,
}: {
  item: ResolvedItem;
  status: EffectiveStatus;
  items: ResolvedItem[];
  today: string;
  now: number;
  next?: ResolvedItem;
}) {
  const s = useAppState();
  const [editNote, setEditNote] = useState(false);
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
    const nowMin = minutesOfDay(new Date());
    updateDay(today, (d) => moveItem(d, items, item.id, Math.ceil(nowMin) + 15));
  };

  if (active && type.mode === 'tilt') {
    return (
      <>
        <TiltGuide day={programDay(s.settings.tiltStartDate, today)} color={type.color} onFinish={finish} />
        <NextLine next={next} />
      </>
    );
  }

  // Phase inside the block (pomodoro focus/break, walk turnaround).
  let phaseLabel = '';
  let ringLabel = active ? 'kaldı' : `${lateMin} dk geçti`;
  let ringSec = leftSec;
  let ringProgress = progress;
  if (active && type.mode === 'pomodoro') {
    const el = (now - startMs) / MIN_MS;
    const phases = pomodoroPhases(item.duration);
    const pi = phases.findIndex((p) => el >= p.start && el < p.end);
    const p = phases[Math.max(0, pi)];
    const focusIdx = phases.filter((x, i) => x.kind === 'focus' && i <= pi).length;
    const focusTotal = phases.filter((x) => x.kind === 'focus').length;
    phaseLabel = p.kind === 'break' ? 'Mola — kalk, su iç, ekrana bakma' : `Odak ${focusIdx}/${focusTotal}`;
    ringSec = (startMs + p.end * MIN_MS - now) / 1000;
    ringProgress = (el - p.start) / (p.end - p.start);
    ringLabel = p.kind === 'break' ? 'mola' : 'odak';
  } else if (active && type.mode === 'walk') {
    const turnAt = startMs + Math.floor(item.duration / 2) * MIN_MS;
    phaseLabel = now < turnAt ? `Dönüş: ${fmt(minutesOfDay(new Date(turnAt)))}` : 'Eve doğru dön';
  }
  const tips = type.tips ?? [];
  const tip = tips.length ? tips[Math.floor(now / (5 * MIN_MS)) % tips.length] : '';

  return (
    <>
      {active && type.mode === 'meditation' && <div className="breath breath-loop" />}
      <div className="now-main">
        <div className="now-head">
          <span className="now-kicker">{active ? 'Şu an' : lateMin > START_GRACE_MIN ? 'Sıra bunda' : 'Başlama zamanı'}</span>
          <h1 className="now-title">{item.label}</h1>
          <span className="now-time num">
            {fmt(item.start)} – {fmt(item.end)} · {fmtDuration(item.duration)}
          </span>
          {phaseLabel && <span className="pill" style={{ alignSelf: 'flex-start' }}>{phaseLabel}</span>}
        </div>
        <Ring size={124} stroke={10} progress={active ? ringProgress : 1} color={active ? type.color : '#fbbf24'}>
          <span className="ring-big num">{active ? fmtClock(ringSec) : `+${lateMin}`}</span>
          <span className="ring-small">{ringLabel}</span>
        </Ring>
      </div>

      {!active && (
        <p className="now-step">
          <b>İLK ADIM</b>
          {type.firstStep}
        </p>
      )}
      {active && tip && <p className="now-step">{tip}</p>}
      {(type.note || editNote) && !editNote && (
        <button className="note-line" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => setEditNote(true)}>
          <Icon name="edit" size={16} />
          <span>
            Sıradaki: <b>{type.note}</b>
          </span>
        </button>
      )}

      <div className="now-actions">
        {active ? (
          <div className="row">
            <button className="btn btn-xl go" onClick={finish}>
              <Icon name="check" /> Bitti
            </button>
            {!type.note && (
              <button className="btn btn-ghost" style={{ minHeight: 64, flex: 'none', width: 64 }} onClick={() => setEditNote(true)} aria-label="Sıradaki notu">
                <Icon name="edit" />
              </button>
            )}
          </div>
        ) : (
          <>
            <button className="btn btn-xl go" onClick={start}>
              {lateMin > START_GRACE_MIN ? 'Şimdi başla' : 'Başladım'}
            </button>
            <div className="row">
              <button className="btn btn-ghost" onClick={later}>
                15 dk sonra
              </button>
              <button className="btn btn-ghost" onClick={skip}>
                <Icon name="skip" /> Atla
              </button>
            </div>
            {lateMin > START_GRACE_MIN && <span className="muted">Şimdi başlarsan sonraki bloklar otomatik kayar.</span>}
          </>
        )}
      </div>
      <NextLine next={next} />
      {editNote && (
        <NoteSheet
          title={`${type.name} — sıradaki`}
          value={type.note}
          onClose={() => setEditNote(false)}
          onSave={(v) => updateType(type.id, (t) => ({ ...t, note: v }))}
        />
      )}
    </>
  );
}

function NoteSheet({ title, value, onSave, onClose }: { title: string; value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(value);
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="sub">Bir dahaki sefere neyle başlayacaksın? Blok başlayınca ekranda yazar, karar vermene gerek kalmaz.</p>
      <textarea className="input" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Örn. Two Sum II, sliding window" />
      <button
        className="btn btn-primary"
        onClick={() => {
          onSave(v.trim());
          onClose();
        }}
      >
        Kaydet
      </button>
    </Sheet>
  );
}

function Free({ next, items, today, now }: { next?: ResolvedItem; items: ResolvedItem[]; today: string; now: number }) {
  const tip = DAILY_HABITS[Math.floor(now / (10 * MIN_MS)) % DAILY_HABITS.length];
  if (!next) return null;
  const inSec = (msAt(today, next.start) - now) / 1000;
  const startEarly = () => updateDay(today, (d) => startItem(d, items, next.id, Date.now()));
  return (
    <>
      <div className="now-main">
        <div className="now-head">
          <span className="now-kicker" style={{ color: '#94a3b8' }}>
            Serbest zaman
          </span>
          <h1 className="now-title">Mola</h1>
          <span className="now-time">Dinlen, su iç, hareket et.</span>
        </div>
        <Ring size={124} stroke={10} progress={1 - Math.min(1, inSec / 3600)} color={next.type.color}>
          <span className="ring-big num">{fmtClock(inSec)}</span>
          <span className="ring-small">sonra</span>
        </Ring>
      </div>
      <p className="now-step">
        <b>DURUŞ</b>
        {tip}
      </p>
      <div className="now-next" style={cssVars({ '--nc': next.type.color })}>
        <i />
        <span>
          Sıradaki: <b className="num">{fmt(next.start)}</b> {next.label}
        </span>
        <span className="spacer" />
        <button className="btn btn-sm btn-ghost" onClick={startEarly}>
          Erken başla
        </button>
      </div>
    </>
  );
}

function Sleep({ dayOver, sleepAt, first }: { dayOver: boolean; sleepAt: number; first?: ResolvedItem }) {
  return (
    <>
      <div>
        <span className="now-kicker" style={{ color: '#a5b4fc' }}>
          {dayOver ? 'Gün tamam' : 'Uyku zamanı'}
        </span>
        <h1 className="now-title">{dayOver ? 'Yavaşla' : 'İyi uykular'}</h1>
        <span className="now-time num">{dayOver ? `Yatış: ${fmt(sleepAt)}. Ekranı bırak.` : 'Telefonu bırak, ışığı kapat.'}</span>
      </div>
      {first && (
        <div className="now-next" style={cssVars({ '--nc': first.type.color })}>
          <i />
          <span>
            {dayOver ? 'Yarın' : 'Sabah'} ilk: <b className="num">{fmt(first.start)}</b> {first.label}
          </span>
        </div>
      )}
    </>
  );
}
