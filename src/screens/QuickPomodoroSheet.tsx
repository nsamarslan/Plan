import { useState } from 'react';
import { cssVars, NumberInput, Sheet, Switch } from '../components/ui';
import { fmt, fmtDuration, minutesOfDay, MIN_MS } from '../lib/time';
import { POMO_PRESETS, QUICK_COLOR, quickDuration, type QuickConfig } from '../model/quick';
import { getQuickConfig, startQuick } from '../store/quick';

/** Start a pomodoro right now, without picking a block from the plan. */
export function QuickPomodoroSheet({ onClose }: { onClose: () => void }) {
  const [c, setC] = useState<QuickConfig>(getQuickConfig);
  const set = (patch: Partial<QuickConfig>) => setC((x) => ({ ...x, ...patch }));
  const total = quickDuration(c);
  const endsAt = fmt(minutesOfDay(new Date(Date.now() + total * MIN_MS)));

  return (
    <Sheet title="Pomodoro" onClose={onClose}>
      <label className="field">
        <span>Ne üzerinde çalışıyorsun? (isteğe bağlı)</span>
        <input className="input" value={c.label} placeholder="örn. LeetCode — 3Sum" onChange={(e) => set({ label: e.target.value })} />
      </label>
      <div className="chips">
        {POMO_PRESETS.map((p) => (
          <button
            key={`${p.focus}/${p.brk}`}
            type="button"
            className="chip"
            aria-pressed={p.focus === c.focus && p.brk === c.brk}
            onClick={() => set({ focus: p.focus, brk: p.brk })}
          >
            {p.focus} / {p.brk}
          </button>
        ))}
      </div>
      <div className="grid3">
        <label className="field">
          <span>Odak (dk)</span>
          <NumberInput min={5} max={240} step={5} value={c.focus} onChange={(v) => v !== undefined && set({ focus: v })} />
        </label>
        <label className="field">
          <span>Mola (dk)</span>
          <NumberInput min={0} max={120} step={5} value={c.brk} onChange={(v) => v !== undefined && set({ brk: v })} />
        </label>
        <label className="field">
          <span>Tur</span>
          <NumberInput min={1} max={12} value={c.rounds} onChange={(v) => v !== undefined && set({ rounds: v })} />
        </label>
      </div>
      <p className="sub num">
        {c.rounds} tur · toplam {fmtDuration(total)} · bitiş {endsAt}
      </p>
      <Switch
        label="Odak modu"
        hint="Odak sırasında bildirimler susar (aramalar gelir), diğer uygulamalar kilitlenir. Molada telefon serbest."
        checked={c.lock}
        onChange={(v) => set({ lock: v })}
      />
      <button
        className="btn btn-xl go"
        style={cssVars({ '--c': QUICK_COLOR })}
        onClick={() => {
          startQuick(c);
          onClose();
        }}
      >
        Başlat
      </button>
    </Sheet>
  );
}
