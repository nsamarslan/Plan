import { useEffect, useRef, useState } from 'react';
import { beep } from '../lib/beep';
import { fmtClock } from '../lib/time';
import { BREATH, MEASURE_DAYS, phaseFor, routineFor, TESTS, type TiltStep } from '../model/tilt';
import { cssVars } from './ui';

// Step-by-step pelvis routine. Every exercise is one screen with one big
// button, so there is nothing to decide while doing it.

const BREATH_CYCLE = BREATH.reduce((s, b) => s + b.sec, 0);
const ROUND_PAUSE = 10;
const SIDE_SWITCH = 5;

function useTicker(running: boolean) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(id);
  }, [running]);
}

export function TiltGuide({ day, color, onFinish }: { day: number; color: string; onFinish: () => void }) {
  const steps = routineFor(day);
  const phase = phaseFor(day);
  const [idx, setIdx] = useState(0);
  const [showTests, setShowTests] = useState(MEASURE_DAYS.includes(day));
  const step = steps[idx];
  const last = idx === steps.length - 1;
  const next = () => (last ? onFinish() : setIdx(idx + 1));

  if (showTests) {
    return (
      <div className="guide" style={cssVars({ '--c': color })}>
        <div className="now-kicker">Ölçüm günü · Gün {day}</div>
        <div className="guide-h">
          <h3>Önce 4 test</h3>
        </div>
        <ol>
          {TESTS.map((t) => (
            <li key={t.id}>
              <b>{t.name}:</b> {t.text}
            </li>
          ))}
        </ol>
        <button className="btn btn-xl go" onClick={() => setShowTests(false)}>
          Testleri yaptım → Rutine geç
        </button>
      </div>
    );
  }

  return (
    <div className="guide" style={cssVars({ '--c': color })}>
      <div className="guide-progress">
        {steps.map((_, i) => (
          <i key={i} className={i <= idx ? 'on' : ''} />
        ))}
      </div>
      <div className="now-kicker">
        Gün {Math.min(day, 56)} · {phase.wk} · {phase.name}
      </div>
      <div className="guide-h">
        <h3>{step.ex.name}</h3>
        <span className="pill">{step.ex.dose}</span>
      </div>
      <StepBody key={idx} step={step} onDone={next} last={last} />
      <details>
        <summary className="muted">Nasıl yapılır</summary>
        <ol>
          {step.ex.how.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ol>
      </details>
      <div className="guide-cue">{step.ex.cue}</div>
      <div className="row">
        <button className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          ← Geri
        </button>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={next}>
          {last ? 'Rutini bitir' : 'Bu adımı geç →'}
        </button>
      </div>
    </div>
  );
}

function StepBody({ step, onDone, last }: { step: TiltStep; onDone: () => void; last: boolean }) {
  if (step.kind === 'breath') return <BreathStep step={step} onDone={onDone} />;
  if (step.kind === 'hold') return <HoldStep step={step} onDone={onDone} />;
  return <RepsStep step={step} onDone={onDone} last={last} />;
}

function BreathStep({ step, onDone }: { step: Extract<TiltStep, { kind: 'breath' }>; onDone: () => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  useTicker(startedAt !== null);
  const roundLen = step.breaths * BREATH_CYCLE;
  const total = step.rounds * roundLen + (step.rounds - 1) * ROUND_PAUSE;
  const el = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  const lastLabel = useRef('');

  let label = 'Hazır olunca başla';
  let scale = 0.5;
  let dur = 1;
  let round = 1;
  let breath = 1;
  const done = startedAt !== null && el >= total;
  if (startedAt !== null && !done) {
    const block = roundLen + ROUND_PAUSE;
    round = Math.floor(el / block) + 1;
    const inRound = el - (round - 1) * block;
    if (inRound >= roundLen) {
      label = 'Dinlen';
      scale = 0.6;
    } else {
      breath = Math.floor(inRound / BREATH_CYCLE) + 1;
      let t = inRound % BREATH_CYCLE;
      for (const b of BREATH) {
        if (t < b.sec) {
          label = b.label;
          scale = b.scale;
          dur = b.sec;
          break;
        }
        t -= b.sec;
      }
    }
  }
  useEffect(() => {
    if (startedAt && label !== lastLabel.current) {
      lastLabel.current = label;
      if (label === 'Burundan al') navigator.vibrate?.(60);
    }
  }, [label, startedAt]);
  useEffect(() => {
    if (done) beep(660, 300);
  }, [done]);

  return (
    <div className="guide">
      <div className="breath" style={cssVars({ transform: `scale(${scale})`, '--dur': `${dur}s` })} />
      <div className="guide-side">{done ? 'Tamam' : label}</div>
      {startedAt !== null && !done && (
        <div className="muted" style={{ textAlign: 'center' }}>
          Tur {round}/{step.rounds} · Nefes {breath}/{step.breaths}
        </div>
      )}
      {startedAt === null ? (
        <button className="btn btn-xl go" onClick={() => setStartedAt(Date.now())}>
          Pozisyondayım, başlat
        </button>
      ) : (
        done && (
          <button className="btn btn-xl go" onClick={onDone}>
            Sonraki →
          </button>
        )
      )}
    </div>
  );
}

function HoldStep({ step, onDone }: { step: Extract<TiltStep, { kind: 'hold' }>; onDone: () => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  useTicker(startedAt !== null);
  const seg = step.seconds + SIDE_SWITCH;
  const total = step.sides.length * seg - SIDE_SWITCH;
  const el = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  const done = startedAt !== null && el >= total;
  const i = Math.min(step.sides.length - 1, Math.floor(el / seg));
  const inSeg = el - i * seg;
  const switching = !done && startedAt !== null && inSeg >= step.seconds;
  const left = switching ? seg - inSeg : step.seconds - inSeg;
  const lastPhase = useRef('');
  const phaseKey = done ? 'done' : `${i}-${switching}`;
  useEffect(() => {
    if (startedAt === null || phaseKey === lastPhase.current) return;
    lastPhase.current = phaseKey;
    beep(phaseKey === 'done' ? 660 : 880);
  }, [phaseKey, startedAt]);

  return (
    <div className="guide">
      <div className="guide-side">
        {startedAt === null
          ? `${step.sides[0]} taraf ile başla`
          : done
            ? 'Tamam'
            : switching
              ? `Taraf değiştir → ${step.sides[i + 1]}`
              : `${step.sides[i]} taraf · ${i + 1}/${step.sides.length}`}
      </div>
      <div className="guide-timer num">{fmtClock(startedAt === null ? step.seconds : done ? 0 : left)}</div>
      {startedAt === null ? (
        <button className="btn btn-xl go" onClick={() => setStartedAt(Date.now())}>
          Pozisyondayım, başlat
        </button>
      ) : (
        done && (
          <button className="btn btn-xl go" onClick={onDone}>
            Sonraki →
          </button>
        )
      )}
    </div>
  );
}

function RepsStep({ step, onDone, last }: { step: Extract<TiltStep, { kind: 'reps' }>; onDone: () => void; last: boolean }) {
  const [set, setSet] = useState(1);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  useTicker(restUntil !== null);
  const restLeft = restUntil ? (restUntil - Date.now()) / 1000 : 0;
  useEffect(() => {
    if (restUntil !== null && restLeft <= 0) {
      setRestUntil(null);
      setSet((s) => s + 1);
      beep();
    }
  }, [restLeft, restUntil]);

  if (restUntil !== null) {
    return (
      <div className="guide">
        <div className="guide-side">Dinlen · sonra set {set + 1}</div>
        <div className="guide-timer num">{fmtClock(restLeft)}</div>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setRestUntil(null);
            setSet(set + 1);
          }}
        >
          Hazırım, devam
        </button>
      </div>
    );
  }
  const finalSet = set >= step.sets;
  return (
    <div className="guide">
      <div className="guide-side">
        Set {set}/{step.sets}
      </div>
      <div className="guide-timer">{step.reps}</div>
      <button
        className="btn btn-xl go"
        onClick={() => {
          if (finalSet) onDone();
          else setRestUntil(Date.now() + step.rest * 1000);
        }}
      >
        {finalSet ? (last ? 'Rutin bitti ✓' : 'Set bitti → Sonraki hareket') : 'Set bitti'}
      </button>
    </div>
  );
}
