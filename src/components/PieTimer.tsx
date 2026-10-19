import { fmtClock } from '../lib/time';
import type { PomodoroPhase } from '../model/schedule';

// "Time Timer" style countdown: the colored wedge is the time left in the
// current phase and shrinks back toward 12 o'clock. The thin outer ring is the
// whole block: focus and break slices, dimmed once they are behind you, with a
// dot for "now".

export const BREAK_COLOR = '#5eead4';

const C = 100;
const RING_R = 94;
const FACE_R = 77;
const WEDGE_R = 71;
const HUB_R = 31;

function point(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

/** Stroke arc from `a0` to `a1` degrees (clockwise from 12 o'clock). */
function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = point(r, a0);
  const [x1, y1] = point(r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Filled pie slice from 12 o'clock clockwise over `frac` of the circle. */
function wedge(r: number, frac: number): string | null {
  if (frac <= 0) return null;
  if (frac >= 0.9999) return `M ${C} ${C - r} A ${r} ${r} 0 1 1 ${C - 0.01} ${C - r} Z`;
  const [x, y] = point(r, frac * 360);
  return `M ${C} ${C} L ${C} ${C - r} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
}

export function PieTimer({
  phaseLeftSec,
  phaseTotalSec,
  kind,
  color,
  phases,
  blockMin,
  elapsedMin,
  label,
  className,
}: {
  phaseLeftSec: number;
  phaseTotalSec: number;
  kind: 'focus' | 'break';
  color: string;
  phases: PomodoroPhase[];
  blockMin: number;
  elapsedMin: number;
  label: string;
  className?: string;
}) {
  const frac = phaseTotalSec > 0 ? Math.min(1, Math.max(0, phaseLeftSec / phaseTotalSec)) : 0;
  const fill = kind === 'break' ? BREAK_COLOR : color;
  const deg = (min: number) => (min / blockMin) * 360;
  const nowDeg = deg(Math.min(elapsedMin, blockMin));
  const [mx, my] = point(RING_R, nowDeg);

  // Minute ticks for the current phase; every 5th is longer. Long phases tick every 5 minutes.
  const phaseMin = Math.round(phaseTotalSec / 60);
  const step = phaseMin > 60 ? 5 : 1;
  const ticks = [];
  for (let m = 0; m < phaseMin; m += step) {
    const major = m % 5 === 0;
    const a = (m / phaseMin) * 360;
    const [x0, y0] = point(FACE_R - (major ? 7 : 3.5), a);
    const [x1, y1] = point(FACE_R - 1, a);
    ticks.push(
      <line key={m} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fff" strokeOpacity={major ? 0.45 : 0.2} strokeWidth={major ? 1.6 : 1} strokeLinecap="round" />,
    );
  }

  const mins = Math.ceil(phaseLeftSec / 60);
  const aria = `${kind === 'break' ? 'Mola' : 'Odak'}: ${mins} dakika kaldı`;

  return (
    <svg className={className} viewBox="0 0 200 200" role="img" aria-label={aria}>
      {/* whole block: focus / break slices */}
      {phases.map((p, i) => {
        const a0 = deg(p.start) + 1.5;
        const a1 = deg(p.end) - 1.5;
        if (a1 - a0 < 0.5) return null;
        const c = p.kind === 'break' ? BREAK_COLOR : color;
        const split = Math.min(Math.max(nowDeg, a0), a1);
        return (
          <g key={i} fill="none" strokeWidth={6} strokeLinecap="butt">
            {split > a0 && <path d={arc(RING_R, a0, split)} stroke={c} strokeOpacity={0.22} />}
            {split < a1 && <path d={arc(RING_R, split, a1)} stroke={c} strokeOpacity={0.9} />}
          </g>
        );
      })}
      <circle cx={mx} cy={my} r={5} fill="#fff" stroke="#0b0f14" strokeWidth={2} />

      {/* current phase */}
      <circle cx={C} cy={C} r={FACE_R} fill="#0b0f14" fillOpacity={0.72} stroke="#fff" strokeOpacity={0.08} />
      {(() => {
        const d = wedge(WEDGE_R, frac);
        return d ? <path d={d} fill={fill} fillOpacity={0.92} /> : null;
      })()}
      {ticks}
      <circle cx={C} cy={C} r={HUB_R} fill="#0b0f14" stroke="#fff" strokeOpacity={0.1} />
      <text x={C} y={C + 2} textAnchor="middle" fill="#eef2f5" fontSize={phaseLeftSec >= 3600 ? 13 : 17} fontWeight={800} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {fmtClock(phaseLeftSec)}
      </text>
      <text x={C} y={C + 16} textAnchor="middle" fill="#a9b6c2" fontSize={8.5} fontWeight={700} letterSpacing={0.6}>
        {label}
      </text>
    </svg>
  );
}
