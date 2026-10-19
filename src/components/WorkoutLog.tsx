import { useEffect, useMemo, useRef, useState } from 'react';
import { beep } from '../lib/beep';
import { fmtClock, fmtDateShort, type DateKey } from '../lib/time';
import { isRampDay } from '../model/roadmap';
import {
  addSet,
  baseSets,
  clampRest,
  exerciseHistory,
  fmtSet,
  nextSet,
  plannedWorkout,
  readyToAdd,
  removeSet,
  REST_COLOR,
  setHint,
  setRest,
  updateSet,
  WORKOUT_NAMES,
  workoutTotals,
  type PastSets,
} from '../model/workout';
import type { ExerciseLog, SetLog, WorkoutLog as Log } from '../model/types';
import { getDay, updateDay, updateSettings, useAppState } from '../store/store';
import { nudgeRest, startRest, stopRest, useRest } from '../store/rest';
import { toast } from '../services/toast';
import { cssVars, Icon, NumberInput, Sheet } from './ui';

// The weights block on the Şimdi screen: one card per exercise, one row per
// set. ✓ saves the set (an empty field takes the grey suggestion) and starts
// the rest; when the rest is over the phone rings.

export function WorkoutLog({ date, color, onFinish }: { date: DateKey; color: string; onFinish: () => void }) {
  const s = useAppState();
  const prefs = s.settings.exercisePrefs;
  const [pick, setPick] = useState<string>();
  const [editing, setEditing] = useState<number | null>(null);
  const saved = s.days[date]?.workout;
  const w = saved ?? plannedWorkout(date, prefs, pick);
  const names = (w?.exercises ?? []).map((e) => e.name).join('|');
  const history = useMemo(
    () => Object.fromEntries(names.split('|').map((n) => [n, exerciseHistory(s.days, n, date, 3)])),
    [names, date, s.days],
  );

  if (!w) {
    return (
      <div className="guide" style={cssVars({ '--c': color })}>
        <div className="now-kicker">Bugün programda ağırlık yok</div>
        <div className="guide-h">
          <h3>Hangisini yapıyorsun?</h3>
        </div>
        <div className="grid2">
          {WORKOUT_NAMES.map((n) => (
            <button key={n} className="btn btn-ghost" onClick={() => setPick(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Always build on the freshest copy: a kg typed just before ✓ is saved on blur.
  const edit = (fn: (x: Log) => Log) => updateDay(date, (d) => ({ ...d, workout: fn(d.workout ?? w) }));

  const check = (ei: number, si: number, hint: SetLog) => {
    const cur = getDay(date).workout ?? w;
    const ex = cur.exercises[ei];
    const x = ex.sets[si];
    if (x.done) {
      edit((l) => updateSet(l, ei, si, { done: false }));
      return;
    }
    const next = updateSet(cur, ei, si, { kg: x.kg ?? hint.kg, reps: x.reps ?? hint.reps, done: true });
    updateDay(date, (d) => ({ ...d, workout: next }));
    const n = nextSet(next, ei);
    if (!n) {
      stopRest();
      toast({ title: 'Tüm setler tamam', body: 'Eline sağlık. "Antrenmanı bitir"e bas.', color: REST_COLOR });
      return;
    }
    const nx = next.exercises[n.ei];
    startRest(ex.restSec, `${nx.name} · ${n.si + 1}. set`);
  };

  const totals = workoutTotals(w);
  const ed = editing !== null ? w.exercises[editing] : undefined;

  return (
    <div className="guide workout" style={cssVars({ '--c': color })}>
      <div className="row">
        <div className="now-kicker">Antrenman</div>
        <span className="spacer" />
        <span className="pill num">
          {totals.done}/{totals.total} set
        </span>
      </div>
      <div className="guide-h">
        <h3>{w.name}</h3>
      </div>

      <RestBar />

      {w.exercises.map((e, ei) => (
        <ExerciseCard
          key={e.name}
          e={e}
          last={history[e.name]?.[0]}
          onCheck={(si, hint) => check(ei, si, hint)}
          onSet={(si, patch) => edit((l) => updateSet(l, ei, si, patch))}
          onAdd={() => edit((l) => addSet(l, ei))}
          onRemove={() => edit((l) => removeSet(l, ei))}
          onSettings={() => setEditing(ei)}
        />
      ))}

      {totals.volume > 0 && <p className="muted">Toplam hacim: {totals.volume.toLocaleString('tr-TR')} kg</p>}
      <button
        className="btn btn-xl go"
        onClick={() => {
          stopRest();
          onFinish();
        }}
      >
        <Icon name="check" /> Antrenmanı bitir
      </button>

      {ed && editing !== null && (
        <ExerciseSheet
          e={ed}
          programSets={prefs[ed.name]?.sets ?? baseSets(ed.name) ?? ed.sets.length}
          rampNote={prefs[ed.name]?.sets === undefined && isRampDay(date)}
          history={history[ed.name] ?? []}
          onClose={() => setEditing(null)}
          onRest={(sec) => {
            const v = clampRest(sec);
            edit((l) => setRest(l, editing, v));
            updateSettings((st) => ({ ...st, exercisePrefs: { ...st.exercisePrefs, [ed.name]: { ...st.exercisePrefs[ed.name], restSec: v } } }));
          }}
          onProgramSets={(n) =>
            updateSettings((st) => ({ ...st, exercisePrefs: { ...st.exercisePrefs, [ed.name]: { ...st.exercisePrefs[ed.name], sets: n } } }))
          }
        />
      )}
    </div>
  );
}

function ExerciseCard({
  e,
  last,
  onCheck,
  onSet,
  onAdd,
  onRemove,
  onSettings,
}: {
  e: ExerciseLog;
  last?: PastSets;
  onCheck: (si: number, hint: SetLog) => void;
  onSet: (si: number, patch: SetLog) => void;
  onAdd: () => void;
  onRemove: () => void;
  onSettings: () => void;
}) {
  const up = readyToAdd(last, e.reps);
  const allDone = e.sets.every((x) => x.done);
  return (
    <div className={`ex-card ${allDone ? 'ex-card--done' : ''}`}>
      <div className="ex-h">
        <div className="grow">
          <b>{e.name}</b>
          <small>
            {e.sets.length}×{e.reps}
          </small>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onSettings} aria-label={`${e.name} dinlenme ve set ayarı`}>
          <Icon name="timer" size={16} /> {fmtClock(e.restSec)}
        </button>
      </div>
      {last && (
        <p className="ex-last">
          Geçen ({fmtDateShort(last.date)}): {last.sets.map(fmtSet).join(' · ')}
          {up && <span className="ex-up"> ↑ ağırlığı artır</span>}
        </p>
      )}
      {e.sets.map((x, si) => {
        const hint = setHint(e.name, e.reps, last, si, e.sets);
        return (
          <div key={si} className={`set-row ${x.done ? 'set-row--done' : ''}`}>
            <span className="set-no num">{si + 1}</span>
            <NumberInput
              value={x.kg}
              placeholder={hint.kg !== undefined ? String(hint.kg) : 'kg'}
              label={`${si + 1}. set kg`}
              min={0}
              max={500}
              step={0.5}
              decimals
              allowEmpty
              onChange={(v) => onSet(si, { kg: v })}
            />
            <span className="set-x">×</span>
            <NumberInput
              value={x.reps}
              placeholder={hint.reps !== undefined ? String(hint.reps) : 'tekrar'}
              label={`${si + 1}. set tekrar`}
              min={0}
              max={300}
              allowEmpty
              onChange={(v) => onSet(si, { reps: v })}
            />
            <button
              className={`set-check ${x.done ? 'on' : ''}`}
              onClick={() => onCheck(si, hint)}
              aria-label={x.done ? `${si + 1}. seti geri al` : `${si + 1}. set tamam`}
            >
              <Icon name="check" />
            </button>
          </div>
        );
      })}
      <div className="row">
        <button className="btn btn-sm btn-ghost" onClick={onRemove} disabled={e.sets.length <= 1}>
          − Set
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onAdd}>
          + Set
        </button>
      </div>
    </div>
  );
}

/** Countdown between sets. Rings (in the app and as a notification) at zero. */
function RestBar() {
  const rest = useRest();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);
  const left = rest ? (rest.endsAt - now) / 1000 : 0;
  const over = !!rest && left <= 0;
  const rang = useRef<number | null>(null);
  useEffect(() => {
    if (!rest || !over || rang.current === rest.endsAt) return;
    rang.current = rest.endsAt;
    beep(880, 180);
    setTimeout(() => beep(880, 180), 300);
    setTimeout(() => beep(1320, 320), 600);
    navigator.vibrate?.([300, 120, 300]);
  }, [rest, over]);
  // Forgotten for a minute after it rang: clear it.
  useEffect(() => {
    if (rest && left < -60) stopRest();
  }, [rest, left]);
  if (!rest) return null;
  const progress = over ? 1 : 1 - left / rest.totalSec;
  return (
    <div className={`rest-bar ${over ? 'rest-bar--over' : ''}`} style={cssVars({ '--p': progress })}>
      <div className="rest-main">
        <span className="rest-time num">{over ? 'Bitti' : fmtClock(Math.ceil(left))}</span>
        <span className="rest-label">{over ? `Sıradaki: ${rest.label}` : `Dinlenme · sonra ${rest.label}`}</span>
      </div>
      <div className="row">
        {!over && (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => nudgeRest(-15)}>
              −15 sn
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => nudgeRest(15)}>
              +15 sn
            </button>
          </>
        )}
        <button className="btn btn-sm btn-ghost" onClick={stopRest}>
          {over ? 'Tamam' : 'Geç'}
        </button>
      </div>
    </div>
  );
}

function ExerciseSheet({
  e,
  programSets: sets,
  rampNote,
  history,
  onClose,
  onRest,
  onProgramSets,
}: {
  e: ExerciseLog;
  programSets: number;
  rampNote: boolean;
  history: PastSets[];
  onClose: () => void;
  onRest: (sec: number) => void;
  onProgramSets: (n: number) => void;
}) {
  return (
    <Sheet title={e.name} onClose={onClose}>
      <div className="field">
        <span>Dinlenme (bu hareket için hatırlanır)</span>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => onRest(e.restSec - 15)}>
            −15 sn
          </button>
          <b className="num stepper-v">{fmtClock(e.restSec)}</b>
          <button className="btn btn-ghost" onClick={() => onRest(e.restSec + 15)}>
            +15 sn
          </button>
        </div>
      </div>
      <div className="field">
        <span>Programdaki set sayısı (sonraki antrenmanlardan itibaren)</span>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => onProgramSets(Math.max(1, sets - 1))} disabled={sets <= 1}>
            −
          </button>
          <b className="num stepper-v">{sets} set</b>
          <button className="btn btn-ghost" onClick={() => onProgramSets(Math.min(10, sets + 1))} disabled={sets >= 10}>
            +
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {rampNote ? "1 Kasım'a kadar bundan 1 set eksik yapılıyor. " : ''}Sadece bugün farklı yapacaksan kartın altındaki "+ Set / − Set"i kullan.
        </p>
      </div>
      {history.length > 0 && (
        <div className="field">
          <span>Son antrenmanlar</span>
          <div className="list">
            {history.map((h) => (
              <div key={h.date} className="list-row">
                <span className="num" style={{ minWidth: 56 }}>
                  {fmtDateShort(h.date)}
                </span>
                <span className="grow num">{h.sets.map(fmtSet).join(' · ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
