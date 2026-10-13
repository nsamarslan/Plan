import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useFocusAudioController } from './audio/controller';
import { Icon, Toasts } from './components/ui';
import { useNow } from './hooks/useNow';
import { dateKey } from './lib/time';
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
const TABS = [
    { id: 'now', label: 'Şimdi', icon: 'now' },
    { id: 'today', label: 'Bugün', icon: 'today' },
    { id: 'plan', label: 'Plan', icon: 'plan' },
    { id: 'stats', label: 'Takip', icon: 'stats' },
    { id: 'settings', label: 'Ayarlar', icon: 'settings' },
];
export function App() {
    const [tab, setTab] = useState('now');
    const now = useNow(1000);
    const s = useAppState();
    const today = dateKey(new Date(now));
    const { current, currentStatus, currentDate } = nowStateAround(today, s.template, s.types, s.days, now);
    const inBreak = !!current && currentStatus === 'active' && current.type.mode === 'pomodoro' && pomodoroAt(current, currentDate, now).phase.kind === 'break';
    const quick = useQuickSession();
    const quickAudio = quick
        ? { key: quickKey(quick), label: quickLabel(quick), inBreak: quickState(quick, now).phase.kind === 'break' }
        : undefined;
    // Audio keeps playing while you move between tabs (and pauses in pomodoro breaks).
    const audio = useFocusAudioController(s.settings, current, currentStatus, currentDate, inBreak, quickAudio);
    // A standalone pomodoro that ran out ends by itself.
    useEffect(() => {
        if (quick && expireQuick(now)) {
            toast({ title: `${quickLabel(quick)} bitti`, body: `${quick.rounds} tur tamam. Eline sağlık.`, color: QUICK_COLOR });
        }
    }, [now, quick]);
    // Opening the app from a block notification always lands on "Şimdi".
    useEffect(() => {
        const go = () => setTab('now');
        window.addEventListener('planOpenNow', go);
        return () => window.removeEventListener('planOpenNow', go);
    }, []);
    return (_jsxs("div", { className: "shell", children: [_jsx("div", { hidden: tab !== 'now', children: _jsx(NowScreen, { now: now, audio: audio, onOpenToday: () => setTab('today') }) }), tab === 'today' && _jsx(TodayScreen, { now: now }), tab === 'plan' && _jsx(PlanScreen, {}), tab === 'stats' && _jsx(StatsScreen, { now: now }), tab === 'settings' && _jsx(SettingsScreen, {}), tab !== 'now' && (_jsx("nav", { className: "tabs", children: _jsx("div", { className: "tabs-in", children: TABS.map((t) => (_jsxs("button", { className: "tab", "aria-current": tab === t.id ? 'page' : undefined, onClick: () => setTab(t.id), children: [_jsx(Icon, { name: t.icon }), t.label] }, t.id))) }) })), _jsx(Toasts, {})] }));
}
