import { useMemo, useState } from 'react';
import { useFocusAudioController } from './audio/controller';
import { Icon, Toasts, type IconName } from './components/ui';
import { useNow } from './hooks/useNow';
import { dateKey } from './lib/time';
import { nowState, resolveDay } from './model/schedule';
import { NowScreen } from './screens/NowScreen';
import { PlanScreen } from './screens/PlanScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { useAppState } from './store/store';

type Tab = 'now' | 'today' | 'plan' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'now', label: 'Şimdi', icon: 'now' },
  { id: 'today', label: 'Bugün', icon: 'today' },
  { id: 'plan', label: 'Plan', icon: 'plan' },
  { id: 'stats', label: 'Takip', icon: 'stats' },
  { id: 'settings', label: 'Ayarlar', icon: 'settings' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('now');
  const now = useNow(1000);
  const s = useAppState();
  const today = dateKey(new Date(now));
  const items = useMemo(() => resolveDay(today, s.template, s.types, s.days[today]), [today, s.template, s.types, s.days]);
  const { current, currentStatus } = nowState(items, today, now);
  // Audio keeps playing while you move between tabs.
  const audio = useFocusAudioController(s.settings, current, currentStatus, today);

  return (
    <div className="shell">
      {tab === 'now' && <NowScreen now={now} audio={audio} onOpenToday={() => setTab('today')} />}
      {tab === 'today' && <TodayScreen now={now} />}
      {tab === 'plan' && <PlanScreen />}
      {tab === 'stats' && <StatsScreen now={now} />}
      {tab === 'settings' && <SettingsScreen />}
      {tab !== 'now' && (
        <nav className="tabs">
          <div className="tabs-in">
            {TABS.map((t) => (
              <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} />
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      )}
      <Toasts />
    </div>
  );
}
