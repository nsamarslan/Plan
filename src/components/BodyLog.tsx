import { useMemo } from 'react';
import { fmtDateShort, weekday, type DateKey } from '../lib/time';
import { intake, lastWeight, PROTEIN_GOAL, recentWorkouts, WATER_GOAL, weighIns } from '../model/body';
import type { BodyLog } from '../model/types';
import { updateDay, useAppState } from '../store/store';
import { NumberInput } from './ui';

const dec = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Today screen: weight on weigh-in day, protein and water with one-tap adds. */
export function BodyCard({ date }: { date: DateKey }) {
  const s = useAppState();
  const b = s.days[date]?.body ?? {};
  const prev = useMemo(() => lastWeight(s.days, date), [s.days, date]);
  const set = (patch: BodyLog) => updateDay(date, (d) => ({ ...d, body: { ...d.body, ...patch } }));
  // Adds build on the saved value, so quick double taps both count.
  const add = (key: 'protein' | 'water', n: number) =>
    updateDay(date, (d) => ({ ...d, body: { ...d.body, [key]: Math.max(0, round1((d.body?.[key] ?? 0) + n)) } }));
  const protein = b.protein ?? 0;
  const water = b.water ?? 0;
  return (
    <div className="card">
      <div className="card-h">
        <h2>Tartı, protein, su</h2>
        {weekday(date) === 1 && <span className="pill">⚖️ Tartı günü</span>}
      </div>
      <div className="body-row">
        <span>Kilo</span>
        <NumberInput
          value={b.kg}
          placeholder={prev !== undefined ? `son: ${dec(prev)}` : 'kg'}
          label="Kilo (kg)"
          min={20}
          max={400}
          step={0.1}
          decimals
          allowEmpty
          onChange={(v) => set({ kg: v === undefined ? undefined : round1(v) })}
        />
        <span className="muted">kg</span>
      </div>
      <div className="body-row">
        <span>Protein</span>
        <NumberInput value={b.protein} placeholder="0" label="Protein (g)" min={0} max={1000} allowEmpty onChange={(v) => set({ protein: v })} />
        <div className="row">
          <button className="btn btn-sm btn-ghost" onClick={() => add('protein', 10)}>
            +10
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => add('protein', 20)}>
            +20
          </button>
        </div>
      </div>
      <div className="body-row">
        <span>Su</span>
        <b className="num">
          {dec(water)} / {WATER_GOAL} L
        </b>
        <div className="row">
          <button className="btn btn-sm btn-ghost" onClick={() => add('water', -0.5)} disabled={water <= 0}>
            −
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => add('water', 0.5)}>
            +0,5 L
          </button>
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Hedef: protein {PROTEIN_GOAL} g{protein ? ` (kalan ${Math.max(0, PROTEIN_GOAL - protein)} g)` : ''} · su {WATER_GOAL} L + limon, antrenman günü +0,5 L. Tartı haftada bir, Pazartesi sabah aç karnına.
      </p>
    </div>
  );
}

/** Takip screen: weigh-ins, intake and the latest workouts. */
export function BodyHistory({ today }: { today: DateKey }) {
  const s = useAppState();
  const weights = useMemo(() => weighIns(s.days, 10), [s.days]);
  const week = useMemo(() => intake(s.days, today, 7), [s.days, today]);
  const workouts = useMemo(() => recentWorkouts(s.days, 8), [s.days]);
  return (
    <>
      <div className="card">
        <div className="card-h">
          <h2>Kilo</h2>
        </div>
        {weights.length ? (
          <div className="list">
            {weights.map((w) => (
              <div key={w.date} className="list-row">
                <span className="grow">{fmtDateShort(w.date)}</span>
                <b className="num">{dec(w.kg)} kg</b>
                <span className="num muted" style={{ minWidth: 56, textAlign: 'right' }}>
                  {w.diff === undefined ? '' : `${w.diff > 0 ? '+' : ''}${dec(w.diff)}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Henüz tartı yok. Pazartesi sabah Bugün ekranından gir.</p>
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Protein ve su · son 7 gün</h2>
        </div>
        {week.proteinDays || week.waterDays ? (
          <p className="sub num">
            {week.protein !== undefined ? `Protein ort. ${week.protein} g (${week.proteinHit}/${week.proteinDays} gün hedefte)` : 'Protein girilmedi'}
            {' · '}
            {week.water !== undefined ? `Su ort. ${dec(week.water)} L (${week.waterHit}/${week.waterDays} gün hedefte)` : 'Su girilmedi'}
          </p>
        ) : (
          <p className="muted">Bugün ekranındaki +10 / +0,5 L düğmeleriyle gir.</p>
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Antrenmanlar</h2>
        </div>
        {workouts.length ? (
          <div className="list">
            {workouts.map((w) => (
              <div key={w.date} className="list-row">
                <span className="grow">
                  {fmtDateShort(w.date)} · {w.name}
                  <small>{w.volume ? `${w.volume.toLocaleString('tr-TR')} kg hacim` : ''}</small>
                </span>
                <span className="num">
                  {w.done}/{w.total} set
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Henüz kayıtlı antrenman yok. Ağırlık bloğunu başlatınca setleri orada girersin.</p>
        )}
      </div>
    </>
  );
}
