import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ArtKey } from '../model/types';
import { dismiss, useToasts } from '../services/toast';

export const artUrl = (key: ArtKey) => `./art/${key}.svg`;

export function cssVars(vars: Record<string, string | number | undefined>): CSSProperties {
  return vars as CSSProperties;
}

const paths: Record<string, ReactNode> = {
  now: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2" />,
  today: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  plan: <path d="M4 6h10M4 12h16M4 18h7M18 4v4M15 16v4" />,
  stats: <path d="M5 20V11M12 20V5M19 20v-6" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  sound: <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />,
  mute: <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM16 9.5l5 5M21 9.5l-5 5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5 10 17l9-10" />,
  skip: <path d="M6 6l8 6-8 6V6ZM18 6v12" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />,
  play: <path d="M7 5v14l12-7L7 5Z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Ring({
  size = 150,
  stroke = 12,
  progress,
  color,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-h">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switch">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onToggle,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={value.includes(o.value)} onClick={() => onToggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Button that only fires after being held for `ms` (for "escape" actions). */
export function HoldButton({ ms = 5000, onDone, children }: { ms?: number; onDone: () => void; children: ReactNode }) {
  const [p, setP] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const startAt = useRef(0);
  const stop = () => {
    cancelAnimationFrame(timer.current!);
    setP(0);
  };
  const tick = () => {
    const v = (Date.now() - startAt.current) / ms;
    if (v >= 1) {
      setP(0);
      onDone();
      return;
    }
    setP(v);
    timer.current = requestAnimationFrame(tick);
  };
  return (
    <button
      className="btn btn-danger hold"
      style={cssVars({ '--p': p })}
      onPointerDown={() => {
        startAt.current = Date.now();
        timer.current = requestAnimationFrame(tick);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      <span>{children}</span>
    </button>
  );
}

export function Toasts() {
  const list = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast" style={cssVars({ '--c': t.color })} onClick={() => dismiss(t.id)}>
          <b>{t.title}</b>
          {t.body && <span>{t.body}</span>}
        </div>
      ))}
    </div>
  );
}

export function TimeInput({ value, onChange }: { value: number; onChange: (min: number) => void }) {
  const h = String(Math.floor(value / 60) % 24).padStart(2, '0');
  const m = String(Math.round(value % 60)).padStart(2, '0');
  return (
    <input
      className="input num"
      type="time"
      value={`${h}:${m}`}
      onChange={(e) => {
        const [hh, mm] = e.target.value.split(':').map(Number);
        if (!Number.isNaN(hh) && !Number.isNaN(mm)) onChange(hh * 60 + mm);
      }}
    />
  );
}
