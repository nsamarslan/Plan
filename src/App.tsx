import { useEffect, useState } from 'react';
import { useFocusAudioController } from './audio/controller';
import { Icon, Toasts, type IconName } from './components/ui';
import { useNow } from './hooks/useNow';
import { dateKey } from './lib/time';
import { isNative, PlanNative } from './native/plan';
import { QUICK_COLOR, quickKey, quickLabel, quickState } from './model/quick';
import { nowStateAround, pomodoroAt } from './model/schedule';
import { toast } from './services/toast';
import { expireQuick, useQuickSession } from './store/quick';
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
  const { current, currentStatus, currentDate } = nowStateAround(today, s.template, s.types, s.days, now);
  const running = !!current && currentStatus === 'active';
  // A pomodoro break or a pause: step away, so music and spoken cues stop too.
  const inBreak =
    running &&
    (current.log.pausedAt !== undefined || (current.type.mode === 'pomodoro' && pomodoroAt(current, currentDate, now).phase.kind === 'break'));
  const quick = useQuickSession();
  const quickAudio = quick
    ? {
        key: quickKey(quick),
        label: quickLabel(quick),
        inBreak: quick.pausedAt !== undefined || quickState(quick, now).phase.kind === 'break',
      }
    : undefined;
  // Audio keeps playing while you move between tabs (and pauses in pomodoro breaks).
  const audio = useFocusAudioController(s.settings, current, currentStatus, currentDate, inBreak, quickAudio);

  // A standalone pomodoro that ran out (or was left paused for hours) ends by itself.
  useEffect(() => {
    if (quick && expireQuick(now)) {
      toast(
        quick.pausedAt !== undefined
          ? { title: `${quickLabel(quick)} kapandı`, body: 'Uzun süre duraklatılmış kaldı.', color: QUICK_COLOR }
          : { title: `${quickLabel(quick)} bitti`, body: `${quick.rounds} tur tamam. Eline sağlık.`, color: QUICK_COLOR },
      );
    }
  }, [now, quick]);

  // The weekly summary notification opens "Takip".
  useEffect(() => {
    if (!isNative) return;
    const take = () =>
      void PlanNative.takeLaunchTab()
        .then(({ tab }) => {
          if (tab === 'stats') setTab('stats');
        })
        .catch(() => {});
    take();
    window.addEventListener('planOpenTab', take);
    return () => window.removeEventListener('planOpenTab', take);
  }, []);

  // Opening the app from a block notification always lands on "Şimdi".
  useEffect(() => {
    const go = () => setTab('now');
    window.addEventListener('planOpenNow', go);
    return () => window.removeEventListener('planOpenNow', go);
  }, []);

  return (
    <div className="shell">
      {/* Kept mounted (just hidden) so a running pelvis routine or timer survives a tab switch. */}
      <div hidden={tab !== 'now'}>
        <NowScreen now={now} audio={audio} onOpenToday={() => setTab('today')} />
      </div>
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
