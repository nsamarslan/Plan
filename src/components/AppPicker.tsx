import { useEffect, useState } from 'react';
import { PlanNative, type AppInfo } from '../native/plan';
import { Icon, Sheet } from './ui';

let cache: AppInfo[] | null = null;

/** Choose Android apps that stay usable while focus mode locks the phone. */
export function AppPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [apps, setApps] = useState<AppInfo[]>(cache ?? []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (cache) return;
    PlanNative.listApps()
      .then((r) => {
        cache = r.apps.sort((a, b) => a.label.localeCompare(b.label, 'tr'));
        setApps(cache);
      })
      .catch(() => {});
  }, []);
  const label = (pkg: string) => apps.find((a) => a.packageName === pkg)?.label ?? pkg;
  const shown = apps.filter((a) => !value.includes(a.packageName) && a.label.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));

  return (
    <div className="chips">
      {value.map((pkg) => (
        <button key={pkg} className="chip" aria-pressed="true" onClick={() => onChange(value.filter((p) => p !== pkg))}>
          {label(pkg)} ✕
        </button>
      ))}
      <button className="chip" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} /> Uygulama ekle
      </button>
      {open && (
        <Sheet title="Uygulama seç" onClose={() => setOpen(false)}>
          <input className="input" placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="list">
            {shown.map((a) => (
              <button
                key={a.packageName}
                className="list-row"
                style={{ background: 'none', border: 0, textAlign: 'left' }}
                onClick={() => {
                  onChange([...value, a.packageName]);
                  setOpen(false);
                }}
              >
                <span className="grow">
                  <b>{a.label}</b>
                  <small>{a.packageName}</small>
                </span>
              </button>
            ))}
            {!apps.length && <p className="muted">Uygulama listesi yüklenemedi.</p>}
          </div>
        </Sheet>
      )}
    </div>
  );
}
