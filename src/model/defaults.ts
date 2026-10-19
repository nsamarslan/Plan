import { dateKey, type Minutes } from '../lib/time';
import type { AudioSettings, BlockType, Settings, TemplateItem } from './types';

const hm = (h: number, m = 0): Minutes => h * 60 + m;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export const WEIGHT_TIPS = [
  'Deadlift kilidinde geriye yaslanma — tepede kalçayı öne itip dur.',
  'Omuz preste bel kavisle geriye kaçıyorsa: kaburga aşağı, karın gergin, gerekirse oturarak bas.',
  'Barfikste sarkarken kaburgalar açılmasın — hafif "hollow" pozisyonda çek.',
  'Bel ekstansiyonu başına en az iki kat kalça ve karın işi koy.',
  'Squat kurulumunda barı alırken kaburgayı indir, karnı sık, sonra otur.',
];

export const DAILY_HABITS = [
  'Kalçana asılma — ağırlık ayağın ortasında, kalça hafif aktif.',
  'Kaburgaları cebine indir: bir nefes ver, alt kaburgalar aşağı-içeri.',
  'Oturma kemiklerinin üstünde otur. 45 dakikada bir kalk.',
  'Düz tabanlı ayakkabı giy, kalın topuk eğimi artırır.',
  'Yatakta dirsek üstünde yüzükoyun uzanma.',
];

export const DEFAULT_TYPES: BlockType[] = [
  {
    id: 'tilt',
    name: 'Pelvis Egzersizi',
    color: '#06b6d4',
    art: 'tilt',
    firstStep: 'Minderi ser, sırtüstü uzan. Ekrandaki ilk adımı yap.',
    mode: 'tilt',
    tracked: true,
    dnd: false,
    notify: true,
    focusAudio: false,
    allowedApps: [],
    note: '',
  },
  {
    id: 'walk',
    name: 'Yürüyüş',
    color: '#84cc16',
    art: 'walk',
    firstStep: 'Ayakkabını giy, su al, kapıdan çık.',
    mode: 'walk',
    tracked: true,
    dnd: false,
    notify: true,
    focusAudio: false,
    allowedApps: [],
    note: '',
    tips: ['Yürürken kaburga aşağı, kalça hafif aktif.', 'Yarı sürede bildirim gelince geri dön.'],
  },
  {
    id: 'weights',
    name: 'Ağırlık Antrenmanı',
    color: '#f97316',
    art: 'weights',
    firstStep: 'Antrenman kıyafetini giy, suyu doldur, ilk hareketin ağırlığını hazırla.',
    mode: 'timer',
    tracked: true,
    dnd: false,
    notify: true,
    focusAudio: false,
    allowedApps: [],
    note: '',
    tips: WEIGHT_TIPS,
  },
  {
    id: 'reading',
    name: 'Okuma',
    color: '#f5b301',
    art: 'reading',
    firstStep: 'Kitabı aç, kaldığın sayfadan başla. Telefonu ters çevir.',
    mode: 'timer',
    tracked: true,
    dnd: true,
    notify: true,
    focusAudio: false,
    allowedApps: [],
    note: '',
  },
  {
    id: 'meditation',
    name: 'Meditasyon',
    color: '#8b5cf6',
    art: 'meditation',
    firstStep: 'Otur, gözlerini kapat, üç derin nefes al.',
    mode: 'meditation',
    tracked: true,
    dnd: true,
    notify: true,
    focusAudio: false,
    allowedApps: [],
    note: '',
  },
  {
    id: 'dsa',
    name: 'Algo',
    color: '#3b82f6',
    art: 'dsa',
    firstStep: "Obsidian'da Dashboard'u aç: önce 'Bugünün tekrarı', sonra 'Henüz denenmedi' listesinin ilk satırı.",
    mode: 'pomodoro',
    focusMin: 50,
    breakMin: 10,
    tracked: true,
    dnd: true,
    notify: true,
    focusAudio: true,
    allowedApps: [],
    note: '',
  },
  {
    id: 'build',
    name: 'Build',
    color: '#10b981',
    art: 'ai',
    firstStep: "FastAPI ilerleme tablosunda ilk ⬜ modülü aç, dünkü commit'e bak, kodu kendin yazmaya başla.",
    mode: 'pomodoro',
    focusMin: 50,
    breakMin: 10,
    tracked: true,
    dnd: true,
    notify: true,
    focusAudio: true,
    allowedApps: [],
    note: '',
  },
  {
    id: 'theory',
    name: 'Teori',
    color: '#d946ef',
    art: 'design',
    firstStep: 'Bugünkü notu aç, başlığı yaz, 5 dakika ne öğreneceğini listele.',
    mode: 'pomodoro',
    focusMin: 50,
    breakMin: 10,
    tracked: true,
    dnd: true,
    notify: true,
    focusAudio: true,
    allowedApps: [],
    note: '',
  },
  {
    id: 'nap',
    name: 'Şekerleme',
    color: '#6366f1',
    art: 'sleep',
    firstStep: "Telefonun alarmını 25 dakikaya kur, uzan, gözlerini kapat. Uyuyamasan da dinlen; 15:00'ten sonra şekerleme yok.",
    mode: 'timer',
    tracked: false,
    dnd: true,
    notify: true,
    focusAudio: false,
    allowedApps: [],
    note: '',
  },
  {
    id: 'review',
    name: 'Yarını Planla',
    color: '#f43f5e',
    art: 'review',
    firstStep: 'Bugün sekmesinde "Yarın"a geç, saatleri kontrol et.',
    mode: 'timer',
    tracked: true,
    dnd: false,
    notify: true,
    focusAudio: false,
    allowedApps: [],
    note: '',
  },
  {
    id: 'meal',
    name: 'Yemek',
    color: '#a8a29e',
    art: 'meal',
    firstStep: 'Ekrandan uzaklaş, sadece ye.',
    mode: 'timer',
    tracked: false,
    dnd: false,
    notify: true,
    focusAudio: false,
    allowedApps: [],
    note: '',
  },
];

let seq = 0;
const tid = () => `t${++seq}`;

const item = (
  typeId: string,
  start: Minutes,
  duration: number,
  extra: Partial<TemplateItem> = {},
): TemplateItem => ({ id: tid(), typeId, start, duration, days: EVERY_DAY, ...extra });

const TRAINING_DAYS = [1, 2, 4, 5];

/**
 * The October 2026 study day (Obsidian hub, "Günlük ritim"): wake 06:30,
 * sleep 23:00, screens off 22:00. 18:6 fasting — eating 13:00–19:00, no
 * breakfast. Every day the same, Sunday included; a rest day is "Off" mode.
 * Algo, Build, Teori and the weights block take their title from the
 * roadmap (roadmap.ts), so they carry no label here.
 * Kötü gün = the hub's minimum mode: due reviews + 1 h build + the basics.
 */
export function defaultTemplate(): TemplateItem[] {
  seq = 0;
  return [
    item('tilt', hm(6, 35), 15, { minimal: true }),
    item('dsa', hm(7, 0), 120, { minimal: true, minimalDuration: 60 }),
    item('build', hm(9, 20), 180, { minimal: true, minimalDuration: 60 }),
    item('meditation', hm(12, 20), 40),
    item('meal', hm(13, 0), 30, { label: 'Öğle Yemeği', minimal: true }),
    item('nap', hm(13, 30), 25, { minimal: true }),
    item('theory', hm(14, 0), 120),
    item('meal', hm(16, 0), 10, { label: 'Ara Öğün', days: TRAINING_DAYS }),
    item('weights', hm(16, 10), 80, { days: TRAINING_DAYS }),
    item('meal', hm(17, 45), 40, { label: 'Akşam Yemeği', minimal: true }),
    item('walk', hm(18, 30), 60, { minimal: true, minimalDuration: 30 }),
    item('reading', hm(20, 30), 60),
  ];
}

export const DEFAULT_PHRASES = [
  "They're staring at you again.",
  'Clear your mind.',
  'Where is your attention right now?',
  'Come back to the task.',
  'Breathe out. Ribs down.',
  'Notice your posture.',
  'One thing at a time.',
  'You are not your thoughts.',
  'Watch the urge. Do not follow it.',
  'Eyes on the work.',
  'Slow down. Be here.',
  'This moment. This task.',
  'Relax your jaw. Drop your shoulders.',
  'Notice the pull. Let it pass.',
  'Finish this one thing.',
  'Awareness is your power.',
  'Nobody is coming. Do it now.',
  'Still on {block}? Stay with it.',
  'Silence the noise. Return to {block}.',
  'You chose this. Keep going.',
];

export function defaultAudio(): AudioSettings {
  return {
    voiceEnabled: true,
    musicEnabled: true,
    when: 'focusBlocks',
    minSec: 120,
    maxSec: 300,
    phrases: DEFAULT_PHRASES.map((text, i) => ({ id: `p${i + 1}`, text, enabled: true })),
    clipIds: [],
    musicIds: [],
    musicVolume: 0.5,
    voiceVolume: 1,
    lang: 'en-US',
    voiceName: '',
    rate: 0.9,
    pitch: 0.8,
  };
}

export function defaultSettings(): Settings {
  return {
    wake: hm(6, 30),
    sleep: hm(23),
    preWarnMin: 5,
    remindEveryMin: 3,
    remindCount: 3,
    dndRanges: [
      {
        // Screens off at 22:00 (monk mode), up at 06:30.
        id: 'night',
        label: 'Gece',
        start: hm(22),
        end: hm(6, 30),
        days: EVERY_DAY,
        silence: true,
        lockApps: true,
        enabled: true,
      },
    ],
    allowedApps: [],
    lockAppsInDndBlocks: true,
    showStreak: false,
    weeklySummary: true,
    weeklySummaryAt: hm(20),
    tiltStartDate: dateKey(new Date()),
    audio: defaultAudio(),
  };
}
