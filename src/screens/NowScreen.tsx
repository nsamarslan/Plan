import { useEffect, useMemo, useState } from 'react';
import { setAudioMuted } from '../audio/controller';
import { BREAK_COLOR, PieTimer } from '../components/PieTimer';
import { QUICK_COLOR, quickDuration, quickEndsAt, quickLabel, quickState, type QuickSession } from '../model/quick';
import { pauseQuick, resumeQuick, stopQuick, useQuickSession } from '../store/quick';
import { QuickPomodoroSheet } from './QuickPomodoroSheet';
import { TiltGuide } from '../components/TiltGuide';
import { artUrl, cssVars, Icon, Ring, Sheet } from '../components/ui';
import { useWakeLock } from '../hooks/useWakeLock';
import { addDays, dateKey, fmt, fmtClock, fmtDuration, minutesOfDay, msAt, MIN_MS } from '../lib/time';
import { DAILY_HABITS } from '../model/defaults';
import { activeFocus, buildFocusWindows } from '../model/notify';
import {
  extendItem,
  finishItem,
  isOffDay,
  nowStateAround,
  pauseItem,
  pomodoroAt,
  resolveDay,
  resumeItem,
  skipItem,
  SNOOZE_MIN,
  snoozeItem,
  START_GRACE_MIN,
  startItem,
  workMinutes,
} from '../model/schedule';
import { dayStats } from '../model/stats';
import { programDay } from '../model/tilt';
import type { ArtKey, EffectiveStatus, ResolvedItem } from '../model/types';
import { isNative } from '../native/plan';
import { planInput } from '../services/scheduler';
import { updateDay, updateType, useAppState } from '../store/store';

const OFF_COLOR = '#34d399';
const PAUSE_COLOR = '#fbbf24';

interface Props {
  now: number;
  onOpenToday: () => void;
  audio: { wanted: boolean; muted: boolean; key: string };
}

export function NowScreen({ now, onOpenToday, audio }: Props) {
  const s = useAppState();
  const today = dateKey(new Date(now));
  const items = useMemo(() => resolveDay(today, s.template, s.types, s.days[today]), [today, s.template, s.types, s.days]);
  // A block from yesterday that runs past midnight still shows up here.
  const st = nowStateAround(today, s.template, s.types, s.days, now);
  const { next } = st;
  let { current, currentStatus, currentDate } = st;
  let currentItems = currentDate === today ? items : resolveDay(currentDate, s.template, s.types, s.days[currentDate]);

  // A pelvis routine in progress stays on screen past the block's planned end
  // (up to 30 min) until "Rutini bitir", instead of vanishing mid-exercise.
  const [guideKey, setGuideKey] = useState<string | null>(null);
  const guideOpen = current?.type.mode === 'tilt' && currentStatus === 'active' ? `${currentDate}|${current.id}` : null;
  useEffect(() => {
    if (guideOpen) setGuideKey(guideOpen);
  }, [guideOpen]);
  if (guideKey && guideKey !== guideOpen) {
    const [gDate, gId] = guideKey.split('|');
    const gItems = gDate === today ? items : resolveDay(gDate, s.template, s.types, s.days[gDate]);
    const gi = gItems.find((i) => i.id === gId);
    if (gi && gi.log.status === 'active' && now < msAt(gDate, gi.end) + 30 * MIN_MS) {
      current = gi;
      currentStatus = 'active';
      currentDate = gDate;
      currentItems = gItems;
    }
  }
  const nowMin = minutesOfDay(new Date(now));
  const stats = dayStats(today, items, now);
  const minuteKey = Math.floor(now / MIN_MS);
  const focus = useMemo(
    () => activeFocus(buildFocusWindows(planInput(minuteKey * MIN_MS)), now),
    [minuteKey, s],
  );
  // A standalone pomodoro (started from the timer button) takes the screen.
  const quick = useQuickSession();
  const [quickOpen, setQuickOpen] = useState(false);
  useWakeLock(!!current || !!quick);
  // The note sheet stays bound to the block type it was opened for, even if the
  // block ends while typing.
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const noteType = noteFor ? s.types[noteFor] : undefined;

  const { wake, sleep } = s.settings;
  // Bedtime may be after midnight (e.g. 00:30), then the night wraps around.
  const night = sleep > wake ? nowMin < wake || nowMin >= sleep : nowMin >= sleep && nowMin < wake;
  const asleep = !current && night;
  // A day off: no plan on screen (yesterday's late block may still finish).
  const off = isOffDay(s.days[today]);
  const offNow = !current && !asleep && off;
  const dayOver = !current && !next && !asleep && !off;
  const tomorrowFirst = useMemo(() => {
    const date = nowMin >= s.settings.wake ? addDays(today, 1) : today;
    if (isOffDay(s.days[date])) return undefined;
    return resolveDay(date, s.template, s.types, s.days[date]).find((i) => i.type.tracked);
  }, [nowMin, s, today]);

  let art: ArtKey = 'free';
  let color = '#64748b';
  if (quick) {
    color = QUICK_COLOR;
  } else if (current) {
    art = current.type.art;
    color = current.type.color;
  } else if (asleep || dayOver) {
    art = 'sleep';
    color = '#6366f1';
  } else if (offNow) {
    color = OFF_COLOR;
  }

  const top = (
    <div className="now-top">
      <span className="now-clock num">{fmt(nowMin)}</span>
      {off ? (
        <span className="pill">Off gün</span>
      ) : (
        <span className="pill num" title="Bugün tamamlanan bloklar">
          {stats.done}/{stats.planned}
        </span>
      )}
      {focus && (
        <span className="pill focus-pill" title={`Odak modu: ${focus.label}`}>
          {/* A block's name is already on screen; a time range (e.g. "Gece") says its own. */}
          <Icon name="lock" /> {focus.itemKey ? '' : `${focus.label} · `}
          {fmt(minutesOfDay(new Date(focus.end)))}
        </span>
      )}
      <span className="spacer" />
      {!quick && (
        <button className="icon-btn" aria-label="Pomodoro başlat" onClick={() => setQuickOpen(true)}>
          <Icon name="timer" />
        </button>
      )}
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
    <div
      className={`now ${!quick && current?.type.mode === 'tilt' && currentStatus === 'active' ? 'now--guide' : ''} ${
        quick || (current?.type.mode === 'pomodoro' && currentStatus === 'active') ? 'now--pomo' : ''
      }`}
      style={cssVars({ '--c': color })}
    >
      <img className="now-art" src={artUrl(art)} alt="" />
      <div className="now-shade" />
      {top}
      <div className="now-body">
        {quick ? (
          <QuickCurrent session={quick} now={now} planNow={current} next={next} />
        ) : current ? (
          <Current
            item={current}
            status={currentStatus!}
            items={currentItems}
            today={currentDate}
            now={now}
            next={next}
            onEditNote={setNoteFor}
          />
        ) : asleep || dayOver ? (
          <Sleep dayOver={dayOver} sleepAt={s.settings.sleep} first={tomorrowFirst} />
        ) : offNow ? (
          <OffDay today={today} first={tomorrowFirst} onQuick={() => setQuickOpen(true)} />
        ) : (
          <Free next={next} items={items} today={today} now={now} onQuick={() => setQuickOpen(true)} />
        )}
      </div>
      {quickOpen && <QuickPomodoroSheet onClose={() => setQuickOpen(false)} />}
      {noteType && (
        <NoteSheet
          title={`${noteType.name} — sıradaki`}
          value={noteType.note}
          onClose={() => setNoteFor(null)}
          onSave={(v) => updateType(noteType.id, (t) => ({ ...t, note: v }))}
        />
      )}
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
  onEditNote,
}: {
  item: ResolvedItem;
  status: EffectiveStatus;
  items: ResolvedItem[];
  today: string;
  now: number;
  next?: ResolvedItem;
  onEditNote: (typeId: string) => void;
}) {
  const s = useAppState();
  const startMs = msAt(today, item.start);
  const endMs = msAt(today, item.end);
  const active = status === 'active';
  // Paused: the clock stands still at the moment of the pause.
  const pausedAt = active ? item.log.pausedAt : undefined;
  const paused = pausedAt !== undefined;
  const clock = pausedAt ?? now;
  const leftSec = (endMs - clock) / 1000;
  const progress = 1 - leftSec / (workMinutes(item) * 60);
  const lateMin = Math.floor((now - startMs) / MIN_MS);
  const pauseMin = paused ? Math.floor((now - pausedAt) / MIN_MS) : 0;
  const type = item.type;

  const start = () => updateDay(today, (d) => startItem(d, items, item.id, Date.now()));
  const finish = () => updateDay(today, (d) => finishItem(d, item.id, Date.now()));
  const skip = () => updateDay(today, (d) => skipItem(d, item.id));
  const later = () => updateDay(today, (d) => snoozeItem(d, items, item.id, Date.now()));
  const pause = () => updateDay(today, (d) => pauseItem(d, item.id, Date.now()));
  const resume = () => updateDay(today, (d) => resumeItem(d, items, item.id, Date.now()));
  const extend = () => updateDay(today, (d) => extendItem(d, items, item.id, Date.now()));

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
  const ringLabel = paused ? 'durdu' : active ? 'kaldı' : `${lateMin} dk geçti`;
  const pomo = active && type.mode === 'pomodoro' ? pomodoroAt(item, today, now) : null;
  let kicker = active ? 'Şu an' : lateMin > START_GRACE_MIN ? 'Sıra bunda' : 'Başlama zamanı';
  if (paused) {
    kicker = 'Duraklatıldı';
    phaseLabel = pauseMin ? `${pauseMin} dk ara` : 'Ara verdin';
  } else if (pomo) {
    const brk = pomo.phase.kind === 'break';
    const after = pomo.phases[pomo.index + 1];
    kicker = brk ? 'Mola' : `Odak ${pomo.focusNo}/${pomo.focusTotal}`;
    phaseLabel = brk
      ? 'Kalk, su iç, ekrana bakma'
      : after
        ? `Sonra ${after.end - after.start} dk ${after.kind === 'break' ? 'mola' : 'odak'}`
        : 'Son odak';
  } else if (active && type.mode === 'walk') {
    const turnAt = startMs + (item.log.pausedMs ?? 0) + Math.floor(workMinutes(item) / 2) * MIN_MS;
    phaseLabel = now < turnAt ? `Dönüş: ${fmt(minutesOfDay(new Date(turnAt)))}` : 'Eve doğru dön';
  }
  const tips = type.tips ?? [];
  const tip = tips.length ? tips[Math.floor(now / (5 * MIN_MS)) % tips.length] : '';

  return (
    <>
      {active && !paused && type.mode === 'meditation' && <div className="breath breath-loop" />}
      {pomo && (
        <div className="pomo-hero">
          <PieTimer
            className="pie-timer"
            phaseLeftSec={pomo.phaseLeftSec}
            phaseTotalSec={pomo.phaseTotalSec}
            kind={pomo.phase.kind}
            color={type.color}
            phases={pomo.phases}
            blockMin={item.duration}
            elapsedMin={pomo.elapsedMin}
            label={paused ? 'DURDU' : pomo.phase.kind === 'break' ? 'MOLA' : `ODAK ${pomo.focusNo}/${pomo.focusTotal}`}
          />
        </div>
      )}
      <div className="now-main">
        <div className="now-head">
          <span
            className="now-kicker"
            style={paused ? { color: PAUSE_COLOR } : pomo?.phase.kind === 'break' ? { color: BREAK_COLOR } : undefined}
          >
            {kicker}
          </span>
          <h1 className="now-title">{item.label}</h1>
          <span className="now-time num">
            {fmt(item.start)} – {fmt(item.end)} · {fmtDuration(item.duration)}
          </span>
          {phaseLabel && <span className="pill" style={{ alignSelf: 'flex-start' }}>{phaseLabel}</span>}
        </div>
        {!pomo && (
          <Ring size={124} stroke={10} progress={active ? progress : 1} color={active && !paused ? type.color : PAUSE_COLOR}>
            <span className="ring-big num">{active ? fmtClock(leftSec) : `+${lateMin}`}</span>
            <span className="ring-small">{ringLabel}</span>
          </Ring>
        )}
      </div>

      {!active && (
        <p className="now-step">
          <b>İLK ADIM</b>
          {type.firstStep}
        </p>
      )}
      {active && !paused && tip && <p className="now-step">{tip}</p>}
      {type.note && (
        <button className="note-line" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => onEditNote(item.typeId)}>
          <Icon name="edit" size={16} />
          <span>
            Sıradaki: <b>{type.note}</b>
          </span>
        </button>
      )}

      <div className="now-actions">
        {paused ? (
          <>
            <button className="btn btn-xl go" onClick={resume}>
              <Icon name="play" /> Devam et
            </button>
            <button className="btn btn-ghost" onClick={finish}>
              <Icon name="check" /> Bitti
            </button>
            <span className="muted">Devam edince bu blok ve sonrakiler ara kadar kayar. Ara, çalışma süresine sayılmaz.</span>
          </>
        ) : active ? (
          <>
            <div className="row">
              <button className="btn btn-xl go" onClick={finish}>
                <Icon name="check" /> Bitti
              </button>
              {!type.note && (
                <button className="btn btn-ghost" style={{ minHeight: 64, flex: 'none', width: 64 }} onClick={() => onEditNote(item.typeId)} aria-label="Sıradaki notu">
                  <Icon name="edit" />
                </button>
              )}
            </div>
            <div className="row">
              <button className="btn btn-ghost" onClick={pause}>
                <Icon name="pause" /> Duraklat
              </button>
              <button className="btn btn-ghost" onClick={extend}>
                +{SNOOZE_MIN} dk
              </button>
            </div>
          </>
        ) : (
          <>
            <button className="btn btn-xl go" onClick={start}>
              {lateMin > START_GRACE_MIN ? 'Şimdi başla' : 'Başladım'}
            </button>
            <div className="row">
              <button className="btn btn-ghost" onClick={later}>
                {SNOOZE_MIN} dk sonra
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

function Free({
  next,
  items,
  today,
  now,
  onQuick,
}: {
  next?: ResolvedItem;
  items: ResolvedItem[];
  today: string;
  now: number;
  onQuick: () => void;
}) {
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
      <button className="btn btn-ghost" onClick={onQuick}>
        <Icon name="timer" /> Pomodoro başlat
      </button>
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

/** A standalone pomodoro: the same pie, with a stop button. */
function QuickCurrent({
  session,
  now,
  planNow,
  next,
}: {
  session: QuickSession;
  now: number;
  planNow?: ResolvedItem;
  next?: ResolvedItem;
}) {
  const [confirmStop, setConfirmStop] = useState(false);
  useEffect(() => {
    if (!confirmStop) return;
    const t = setTimeout(() => setConfirmStop(false), 3000);
    return () => clearTimeout(t);
  }, [confirmStop]);
  const st = quickState(session, now);
  const paused = session.pausedAt !== undefined;
  const brk = st.phase.kind === 'break';
  const after = st.phases[st.index + 1];
  const roundLabel = paused ? 'Duraklatıldı' : brk ? 'Mola' : `Odak ${st.focusNo}/${st.focusTotal}`;
  const pauseMin = paused ? Math.floor((now - session.pausedAt!) / MIN_MS) : 0;
  return (
    <>
      <div className="pomo-hero">
        <PieTimer
          className="pie-timer"
          phaseLeftSec={st.phaseLeftSec}
          phaseTotalSec={st.phaseTotalSec}
          kind={st.phase.kind}
          color={QUICK_COLOR}
          phases={st.phases}
          blockMin={quickDuration(session)}
          elapsedMin={st.elapsedMin}
          label={(paused ? 'Durdu' : roundLabel).toLocaleUpperCase('tr')}
        />
      </div>
      <div className="now-main">
        <div className="now-head">
          <span className="now-kicker" style={{ color: paused ? PAUSE_COLOR : brk ? BREAK_COLOR : QUICK_COLOR }}>
            {roundLabel}
          </span>
          <h1 className="now-title">{quickLabel(session)}</h1>
          <span className="now-time num">
            {session.focus}/{session.brk} · {session.rounds} tur · bitiş {fmt(minutesOfDay(new Date(quickEndsAt(session, now))))}
          </span>
          <span className="pill" style={{ alignSelf: 'flex-start' }}>
            {paused
              ? pauseMin
                ? `${pauseMin} dk ara`
                : 'Ara verdin'
              : brk
                ? 'Kalk, su iç, ekrana bakma'
                : after
                  ? `Sonra ${after.end - after.start} dk ${after.kind === 'break' ? 'mola' : 'odak'}`
                  : 'Son odak'}
          </span>
        </div>
      </div>
      <div className="now-actions">
        {paused && (
          <button className="btn btn-xl go" style={cssVars({ '--c': QUICK_COLOR })} onClick={() => resumeQuick()}>
            <Icon name="play" /> Devam et
          </button>
        )}
        <div className="row">
          {!paused && (
            <button className="btn btn-ghost" style={{ minHeight: 56 }} onClick={() => pauseQuick()}>
              <Icon name="pause" /> Duraklat
            </button>
          )}
          <button
            className={`btn ${confirmStop ? 'btn-danger' : 'btn-ghost'}`}
            style={{ minHeight: 56 }}
            onClick={() => (confirmStop ? stopQuick() : setConfirmStop(true))}
          >
            <Icon name="stop" /> {confirmStop ? 'Tekrar dokun' : 'Bitir'}
          </button>
        </div>
      </div>
      {planNow ? (
        <div className="now-next" style={cssVars({ '--nc': planNow.type.color })}>
          <i />
          <span>
            Planda şimdi: <b>{planNow.label}</b>
          </span>
        </div>
      ) : (
        <NextLine next={next} />
      )}
    </>
  );
}

/** A day off: nothing planned, nothing tracked. */
function OffDay({ today, first, onQuick }: { today: string; first?: ResolvedItem; onQuick: () => void }) {
  return (
    <>
      <div className="now-head">
        <span className="now-kicker" style={{ color: OFF_COLOR }}>
          Off gün
        </span>
        <h1 className="now-title">Bugün senin</h1>
        <span className="now-time">Plan, bildirim ve takip kapalı. Hiçbir şeyi kaçırmıyorsun.</span>
      </div>
      <div className="now-actions">
        <button className="btn btn-ghost" onClick={onQuick}>
          <Icon name="timer" /> Pomodoro başlat
        </button>
        <button className="btn btn-ghost" onClick={() => updateDay(today, (d) => ({ ...d, mode: 'normal' }))}>
          Planı geri aç
        </button>
      </div>
      {first && (
        <div className="now-next" style={cssVars({ '--nc': first.type.color })}>
          <i />
          <span>
            Yarın ilk: <b className="num">{fmt(first.start)}</b> {first.label}
          </span>
        </div>
      )}
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
