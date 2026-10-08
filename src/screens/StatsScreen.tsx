import { useMemo, useState } from 'react';
import { cssVars, Segmented } from '../components/ui';
import { addDays, dateKey, daysBetween, fmtDateLong, fmtDuration, weekday, WEEKDAYS_SHORT } from '../lib/time';
import { effectiveStatus, resolveDay } from '../model/schedule';
import { pct, rangeStats, streak } from '../model/stats';
import { phaseFor, PROGRAM_DAYS, programDay } from '../model/tilt';
import { firstDay, useAppState } from '../store/store';

const BAR = '#60a5fa';

export function StatsScreen({ now }: { now: number }) {
  const s = useAppState();
  const today = dateKey(new Date(now));
  const [range, setRange] = useState<'7' | '30'>('7');
  const [picked, setPicked] = useState<string | null>(null);
  const since = firstDay();

  // Recompute once a minute, not on every clock tick.
  const minuteNow = Math.floor(now / 60_000) * 60_000;
  const week = useMemo(
    () => rangeStats({ end: today, days: 7, nowMs: minuteNow, template: s.template, types: s.types, dayDocs: s.days }),
    [today, minuteNow, s],
  );
  const span = useMemo(
    () => rangeStats({ end: today, days: Number(range), nowMs: minuteNow, template: s.template, types: s.types, dayDocs: s.days, since }),
    [today, minuteNow, s, range, since],
  );
  // The streak is not limited by the 7/30-day selector below.
  const streakDays = useMemo(
    () =>
      s.settings.showStreak
        ? rangeStats({ end: today, days: 366, nowMs: minuteNow, template: s.template, types: s.types, dayDocs: s.days, since }).days
        : [],
    [today, minuteNow, s, since],
  );
  const t = week.days[week.days.length - 1];
  const judged = span.days.reduce(
    (a, d) => ({ planned: a.planned + d.planned - d.open, done: a.done + d.done, doneMin: a.doneMin + d.doneMin }),
    { planned: 0, done: 0, doneMin: 0 },
  );
  const pickedDay = week.days.find((d) => d.date === picked) ?? t;

  // Pelvis program: one dot per program day, filled when the tilt block was done.
  const tiltDay = programDay(s.settings.tiltStartDate, today);
  const tiltDone = useMemo(() => {
    const out: boolean[] = [];
    for (let i = 0; i < PROGRAM_DAYS; i++) {
      const date = addDays(s.settings.tiltStartDate, i);
      if (daysBetween(date, today) < 0) {
        out.push(false);
        continue;
      }
      const items = resolveDay(date, s.template, s.types, s.days[date]);
      out.push(items.some((it) => it.type.mode === 'tilt' && effectiveStatus(it, date, minuteNow) === 'done'));
    }
    return out;
  }, [s, today, minuteNow]);
  const tiltColor = s.types.tilt?.color ?? '#06b6d4';

  return (
    <div className="page">
      <div className="page-h">
        <h1>Takip</h1>
      </div>

      <div className="kpis">
        <div className="kpi">
          <b className="num">%{pct(t.done, t.planned)}</b>
          <span>Bugün</span>
        </div>
        <div className="kpi">
          <b className="num">%{pct(judged.done, judged.planned)}</b>
          <span>Son {range} gün</span>
        </div>
        <div className="kpi">
          <b className="num">{s.settings.showStreak ? streak(streakDays) : fmtDuration(judged.doneMin)}</b>
          <span>{s.settings.showStreak ? 'Seri (gün)' : 'Odak süresi'}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Son 7 gün</h2>
        </div>
        <p className="sub num">
          {fmtDateLong(pickedDay.date)}: {pickedDay.done}/{pickedDay.planned} blok · %{pct(pickedDay.done, pickedDay.planned)} ·{' '}
          {fmtDuration(pickedDay.doneMin)}
          {pickedDay.missed ? ` · ${pickedDay.missed} kaçtı` : ''}
        </p>
        <div className="bars" role="list">
          {week.days.map((d) => {
            const p = pct(d.done, d.planned);
            return (
              <button
                key={d.date}
                className="bar"
                role="listitem"
                style={{ background: 'none', border: 0, padding: 0 }}
                aria-label={`${fmtDateLong(d.date)}: yüzde ${p}`}
                onClick={() => setPicked(d.date)}
              >
                <span className="bar-track" style={{ outline: d.date === pickedDay.date ? '2px solid var(--ink-3)' : 'none' }}>
                  <span className="bar-fill" style={{ height: `${p}%`, background: BAR }} />
                </span>
                <small style={{ color: d.date === today ? 'var(--ink)' : undefined }}>{WEEKDAYS_SHORT[weekday(d.date)]}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Bloklara göre</h2>
          <Segmented
            options={[
              { value: '7', label: '7 gün' },
              { value: '30', label: '30 gün' },
            ]}
            value={range}
            onChange={setRange}
          />
        </div>
        <div className="list">
          {span.byType.map((b) => (
            <div key={b.type.id} className="hbar list-row" style={{ display: 'grid', ...cssVars({ '--c': BAR }) }}>
              <span className="row" style={{ gap: 8 }}>
                <span className="color-dot" style={cssVars({ '--c': b.type.color })} />
                <b>{b.type.name}</b>
              </span>
              <span className="num sub">
                {b.done}/{b.planned} · %{pct(b.done, b.planned)}
              </span>
              <span className="hbar-track">
                <i style={{ width: `${pct(b.done, b.planned)}%` }} />
              </span>
            </div>
          ))}
          {!span.byType.length && <p className="muted">Henüz veri yok.</p>}
        </div>
      </div>

      <div className="card" style={cssVars({ '--c': tiltColor })}>
        <div className="card-h">
          <h2>Pelvis programı</h2>
          <span className="pill num">
            Gün {Math.min(tiltDay, PROGRAM_DAYS)}/{PROGRAM_DAYS}
          </span>
        </div>
        <p className="sub">
          {phaseFor(tiltDay).wk} · {phaseFor(tiltDay).name} — {tiltDone.filter(Boolean).length} gün yapıldı. Kaçırdığın günü telafi etme, ertesi gün devam et.
        </p>
        <div className="dots">
          {tiltDone.map((on, i) => (
            <span key={i} className={`dot ${on ? 'on' : ''} ${i + 1 === tiltDay ? 'today' : ''}`} title={`Gün ${i + 1}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
