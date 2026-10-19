// The study roadmap from the Obsidian hub ("Yeni Isim Hayirli Olsun"), week
// H1 = Monday 19 Oct 2026. The algo, build, theory and weights blocks get a
// title, a first step and details that follow the date; everything else in
// the plan stays as the template says.

import { daysBetween, weekday, type DateKey } from '../lib/time';

export const ROADMAP_START: DateKey = '2026-10-19';
export const ROADMAP_WEEKS = 26;
/** Training restart: one set fewer on every exercise before this day. */
export const FULL_SETS_FROM: DateKey = '2026-11-02';

export interface StudyPhase {
  no: number;
  name: string;
  /** First and last week (H numbers), inclusive. */
  from: number;
  to: number;
  algo: string;
  build: string;
  theory: string;
  career: string;
}

export const STUDY_PHASES: StudyPhase[] = [
  {
    no: 1,
    name: 'Temel',
    from: 1,
    to: 4,
    algo: 'Array & Hashing → Two Pointers → Sliding Window → Stack → Binary Search → Linked List',
    build: 'FastAPI Modül 1-7: type hints, async, Pydantic, HTTP, FastAPI temelleri, DI, proje yapısı. H1: repo public.',
    theory: "SD week 1 (not 00-12, H2'den) · Python 04, 05, 07, 08, 09, 12",
    career: "H2'den itibaren haftada 1 algo mock · H4 cumartesi: 8-10 STAR hikayesi",
  },
  {
    no: 2,
    name: 'Gerçek backend',
    from: 5,
    to: 9,
    algo: 'Trees → Tries → Heap → Backtracking → Graphs',
    build: 'Modül 8-12 + 21: SQLAlchemy/Alembic, repository/service, auth, test, Docker, SQL → docker compose up ile çalışan ürün',
    theory: 'SD week 2-4 (not 13-36) · Python 10, 11, sonra 01-03, 06, 13-15',
    career: "H6: CV v2, LinkedIn, README · H7: remote başvurular (haftada 5-10) · H8'den SD mock",
  },
  {
    no: 3,
    name: 'Production + AI',
    from: 10,
    to: 15,
    algo: 'Advanced Graphs → 1-D DP → 2-D DP → Greedy → Intervals',
    build: 'H10: Modül 13-14 · H11: hafif hafta · H12: Modül 15, 18 · H13-15: AI katmanı',
    theory: 'SD week 5-8 (not 37-62), her gün',
    career: 'H9-11: referans mesajları · H12 (4 Ocak): FAANG başvuruları',
  },
  {
    no: 4,
    name: 'Mülakat modu',
    from: 16,
    to: 18,
    algo: 'Math & Geometry → Bit Manipulation → zayıf set + karışık, süreli',
    build: "Modül 19: deployment, demo linki CV'ye, README'ye mimari ve AI bölümü",
    theory: 'SD mock haftada 2 · behavioral mock · şirkete özel hazırlık',
    career: 'Loop dönemi: her mülakattan sonra 10 dk not',
  },
  {
    no: 5,
    name: 'Tampon',
    from: 19,
    to: 26,
    algo: 'Zayıf set + mock, yeni liste yok',
    build: 'Modül 16, 17, 20 · uzantı 22-23 · ikinci AI özelliği',
    theory: 'Mülakat geri bildirimine göre',
    career: 'Başvurular sürer; hedef rolü geri bildirime göre yeniden tart',
  },
];

/** Roadmap week (1-based) for `date`, or 0 outside the 26 weeks. */
export function weekOf(date: DateKey): number {
  const d = daysBetween(ROADMAP_START, date);
  if (d < 0 || d >= ROADMAP_WEEKS * 7) return 0;
  return Math.floor(d / 7) + 1;
}

export function phaseOf(week: number): StudyPhase | undefined {
  return STUDY_PHASES.find((p) => week >= p.from && week <= p.to);
}

/** Name, sets, target reps, rest between sets (s): main lifts 120, accessories 90, isolation 60. */
export type Move = [name: string, sets: number, reps: string, restSec: number];

export const WORKOUTS: Record<number, { name: string; moves: Move[] }> = {
  1: {
    name: 'Upper A',
    moves: [
      ['Barbell Bench Press', 4, '6-8', 120],
      ['Barbell Row (yatık)', 4, '6-8', 120],
      ['Dumbbell Shoulder Press', 3, '8-10', 90],
      ['Pull-up', 3, 'maks', 90],
      ['Dumbbell Curl', 3, '10-12', 60],
      ['Overhead Triceps Ext. (DB)', 3, '10-12', 60],
    ],
  },
  2: {
    name: 'Lower A',
    moves: [
      ['Barbell Back Squat', 4, '6-8', 120],
      ['Romanian Deadlift', 3, '8-10', 90],
      ['Bulgarian Split Squat (DB)', 3, '8-10/bacak', 90],
      ['Standing Calf Raise (DB)', 3, '15-20', 60],
      ['Dead Bug', 3, '8/taraf', 60],
    ],
  },
  4: {
    name: 'Upper B',
    moves: [
      ['Incline Dumbbell Press', 4, '8-10', 90],
      ['Pull-up / Lat çekiş', 4, '6-10', 90],
      ['Barbell Overhead Press', 3, '6-8', 120],
      ['Dumbbell Row (tek kol)', 3, '10-12', 90],
      ['Lateral Raise (DB)', 3, '12-15', 60],
      ['Hammer Curl', 3, '10-12', 60],
      ['Bench Dips / Skullcrusher', 3, '10-12', 60],
    ],
  },
  5: {
    name: 'Lower B',
    moves: [
      ['Barbell Deadlift', 3, '5', 120],
      ['Goblet / Front Squat', 3, '8-10', 90],
      ['Barbell Hip Thrust (bench)', 3, '8-12', 90],
      ['Reverse Lunge (DB)', 3, '10/bacak', 90],
      ['Seated/Standing Calf Raise', 3, '15-20', 60],
      ['Plank', 3, '30-60 sn', 60],
    ],
  },
};

/** What a block shows on a given day instead of its template defaults. */
export interface BlockPlan {
  label?: string;
  firstStep?: string;
  detail?: string[];
}

const SAT = 6;
const SD_DAYS = [1, 3, 5];

/** True before FULL_SETS_FROM: the restart weeks, one set fewer. */
export const isRampDay = (date: DateKey) => daysBetween(date, FULL_SETS_FROM) > 0;

/** The program's set count for `date` (one fewer during the restart weeks). */
export const programSets = (date: DateKey, sets: number) => (isRampDay(date) ? Math.max(1, sets - 1) : sets);

function weightsPlan(date: DateKey): BlockPlan | undefined {
  const w = WORKOUTS[weekday(date)];
  if (!w) return undefined;
  const ramp = isRampDay(date);
  const moves = w.moves.map(([name, sets, reps]) => `${name} ${programSets(date, sets)}×${reps}`);
  return {
    label: w.name,
    firstStep: `Kıyafetini giy, suyu doldur, ısın. İlk hareket: ${moves[0]}.`,
    detail: [
      ...moves,
      ramp
        ? 'Alışma dönemi (1 Kasım\'a kadar): 1 set eksik, ağırlığı 3 tekrar daha yapabilecekken bırak.'
        : 'Tüm setlerde üst tekrara ulaştıysan sonraki sefer en küçük artışı ekle.',
      'kg×tekrar → Obsidian\'daki bugünün spor notu.',
    ],
  };
}

function algoPlan(week: number, phase: StudyPhase, wd: number): BlockPlan {
  const topics = `Faz ${phase.no} konuları: ${phase.algo}`;
  if (wd === SAT && week >= 2 && phase.no <= 3) {
    return {
      label: 'Algo mock',
      firstStep: "Süreli karışık set: 2 soru, 45'er dakika. Dashboard'a bakmadan çöz.",
      detail: ['Bitince çözümleri Claude ile karşılaştır, bilemediğini not et.', topics],
    };
  }
  const label = phase.no === 4 ? 'Algo · süreli set' : phase.no === 5 ? 'Algo · zayıf set' : 'Algo';
  return { label, detail: ["Sıra: 'Bugünün tekrarı' (en fazla 5) → 'Henüz denenmedi' ilk satır.", topics] };
}

const BUILD_WEEKS: Record<number, [label: string, detail: string]> = {
  10: ['Build · Modül 13-14', 'Middleware, exception handling, background tasks'],
  11: ['Build · hafif hafta', 'Yeni konu yok: tekrar + projede eksikler'],
  12: ['Build · Modül 15, 18', 'Caching, rate limiting, observability'],
  13: ['AI · LLM API', "H14 notu: müşteri destek endpoint'i — tool use ile sipariş durumu, streaming yanıt"],
  14: ['AI · RAG + pgvector', 'H15 notu: ürün açıklamaları ve SSS üzerinde semantic search + küçük retrieval eval seti'],
  15: ['AI · agent + eval', "H16 notu: destek agent'ı (insan onayı), trace, maliyet metriği, LLM-as-judge; README'ye AI mimarisi"],
};

function buildPlan(week: number, phase: StudyPhase, wd: number): BlockPlan {
  if (wd === SAT) {
    return {
      label: 'Build · haftayı kapat',
      firstStep: "Haftanın işini commit'le, FastAPI ilerleme tablosunda biteni ✅ yap, checkpoint'i Claude'a gönder.",
      detail: [phase.build],
    };
  }
  const special = BUILD_WEEKS[week];
  if (special) return { label: special[0], detail: [special[1]] };
  const label =
    phase.no === 1 ? 'Build · Modül 1-7' : phase.no === 2 ? 'Build · Modül 8-12, 21' : phase.no === 4 ? 'Build · deployment' : 'Build · Modül 16, 17, 20';
  return { label, detail: [phase.build] };
}

const SD_STEP = 'Sıradaki SD notunu aç; başlığı yaz, 5 dakika gereksinimleri listele.';
const PY_STEP = "Python hub'ında sıradaki notu aç; ilk kod örneğini kendin yazıp çalıştır.";
const MOCK_STEP = 'Soruyu seç, 45 dakika süre tut; bitince Claude\'dan geri bildirim al.';
const WEEKLY_LOOK = '15 dk haftalık bakış: faz tablosunda neredesin, FastAPI ilerleme tablosu güncel mi?';

function theoryPlan(week: number, phase: StudyPhase, wd: number): BlockPlan {
  const detail = [phase.theory];
  if (wd === SAT) detail.push(WEEKLY_LOOK);
  if (week === 1) return { label: 'Python derinliği', firstStep: PY_STEP, detail: ['H1: Teori bloğunun tamamı Python.', ...detail] };
  if (wd === SAT) {
    if (week === 4) {
      return {
        label: 'STAR hikayeleri',
        firstStep: '7 yılından bir proje seç; Situation, Task, Action, Result olarak dört satır yaz.',
        detail: ['Hedef: 8-10 hikaye, Claude ile tek oturum.', ...detail],
      };
    }
    if (phase.no >= 4) return { label: 'Mock · SD + behavioral', firstStep: MOCK_STEP, detail };
    if (week >= 8) return { label: 'SD mock', firstStep: MOCK_STEP, detail };
    return { label: 'Haftalık tekrar', firstStep: 'Bu haftanın SD ve Python notlarından en zorladığın üçünü aç.', detail };
  }
  if (phase.no === 4) return { label: 'Mülakat hazırlığı', firstStep: MOCK_STEP, detail };
  if (phase.no === 5) return { label: 'Teori · geri bildirime göre', detail };
  if (phase.no === 3 || SD_DAYS.includes(wd)) return { label: 'System Design', firstStep: SD_STEP, detail };
  return { label: 'Python derinliği', firstStep: PY_STEP, detail };
}

/** Date-aware title, first step and details for a block, or undefined to keep the template's. */
export function blockPlan(typeId: string, date: DateKey): BlockPlan | undefined {
  const week = weekOf(date);
  const phase = phaseOf(week);
  if (!phase) return undefined;
  const wd = weekday(date);
  switch (typeId) {
    case 'dsa':
      return algoPlan(week, phase, wd);
    case 'build':
      return buildPlan(week, phase, wd);
    case 'theory':
      return theoryPlan(week, phase, wd);
    case 'weights':
      return weightsPlan(date);
    default:
      return undefined;
  }
}

/** "H1 · Faz 1 Temel" for the top bar, or '' outside the roadmap. */
export function roadmapBadge(date: DateKey): string {
  const week = weekOf(date);
  const phase = phaseOf(week);
  return phase ? `H${week} · Faz ${phase.no} ${phase.name}` : '';
}
