// "Öne Eğik Pelvis Programı" — 8 weeks, 10–15 minutes a day.
// Content comes from the program document; the app turns it into a guided,
// step-by-step routine that changes with the week.

import { daysBetween, type DateKey } from '../lib/time';

export interface Exercise {
  id: string;
  name: string;
  dose: string;
  how: string[];
  cue: string;
}

export const EXERCISES: Record<string, Exercise> = {
  breath: {
    id: 'breath',
    name: '90/90 destekli nefes',
    dose: '5 nefes × 3 tur',
    how: [
      'Sırtüstü yat, ayakların bench\'in üstünde — kalça ve diz 90 derece.',
      'Topuklarla bench\'i hafifçe geriye it, kuyruk sokumunu birkaç santim kaldır. Bel yere yapışsın.',
      'Burundan 4 saniye al. Ağızdan dudak büzerek 8 saniye ver, sonunda 3 saniye daha "boşalt".',
      'Nefesin sonunda alt kaburgaların içeri-aşağı geldiğini hisset.',
    ],
    cue: 'Kalçayı ne kadar yükselttiğin değil, belin yerle teması önemli. Bel kalkıyorsa fazla kaldırmışsın.',
  },
  flexor: {
    id: 'flexor',
    name: 'Yarım diz üstü kalça fleksörü',
    dose: '30 sn / taraf',
    how: [
      'Arka diz minderde, ön ayak önde, ikisi de 90 derece.',
      'Önce pozisyonu kur: karnı sık, kuyruk sokumunu altına al, arka kalçanı sık.',
      'Pozisyonu bozmadan gövdeni 2–3 cm öne kaydır.',
      'Normal nefes almaya devam et.',
    ],
    cue: 'Az hareket + doğru pozisyon. Bel kavislenir kavislenmez germe kaybolur.',
  },
  couch: {
    id: 'couch',
    name: 'Couch stretch',
    dose: '30 sn / taraf',
    how: [
      'Arka ayağının sırtı bench\'e ya da duvara dayalı, diz yerde minderde.',
      'Kalçayı sık, kuyruk sokumunu altına al, sonra gövdeni dikleştir.',
    ],
    cue: 'Ön uyluğun üst kısmını hedefler.',
  },
  bridge: {
    id: 'bridge',
    name: 'Glute bridge — posterior tilt\'li',
    dose: '10–12 tekrar',
    how: [
      'Sırtüstü, dizler bükülü, topuklar kalçana bir karış mesafede.',
      'Önce nefes ver ve beli yere yapıştır. Sonra kalçayı kaldır.',
      'Tepede: kalça sıkışık, karın gergin, bel düz. 2 saniye tut, kontrollü in.',
    ],
    cue: 'Belinde baskı hissediyorsan çok yükselmişsin — kalça kadar yüksel.',
  },
  deadbug: {
    id: 'deadbug',
    name: 'Dead bug',
    dose: '8 tekrar / taraf',
    how: [
      'Sırtüstü, kollar tavana dik, kalça ve diz 90/90.',
      'Elini belinin altına koy — baskı hareket boyunca sabit kalmalı.',
      'Nefes vererek karşı kol ve bacağı uzat. Bel kalkmaya başladığı yerde dur.',
    ],
    cue: 'Menzil değil temas belirler.',
  },
  deadbugW: {
    id: 'deadbugW',
    name: 'Dead bug + 2–3 kg dambıl',
    dose: '8 tekrar / taraf',
    how: [
      'Ellerde hafif dambıl, kollar tavana dik, kalça ve diz 90/90.',
      'Bel yere yapışık; nefes vererek karşı kol ve bacağı uzat.',
    ],
    cue: 'Ağırlık eklenince menzil kısalabilir — temas önce gelir.',
  },
  reverse: {
    id: 'reverse',
    name: 'Reverse crunch',
    dose: '10–12 tekrar',
    how: [
      'Sırtüstü, dizler bükülü, eller yanda ya da bench kenarında.',
      'Pelvisi kıvırarak kalçanı yerden ayır, dizleri göğse getir — sallanmadan.',
    ],
    cue: 'Bacağın ağırlığını değil pelvisin dönüşünü hisset. Yavaş ve kısa iyidir.',
  },
  pallof: {
    id: 'pallof',
    name: 'Pallof press ya da yan plank',
    dose: '10 / taraf ya da 30 sn',
    how: [
      'Bandı barfiks aletine göğüs hizasında bağla, yandan dur, bandı göğsünden öne it, 2 sn tut.',
      'Gövde hiç dönmeyecek. Band yoksa yan plank, 20–30 saniye.',
    ],
    cue: 'Oblikler pelvisi hem geri hem yana stabilize eder.',
  },
  thrust: {
    id: 'thrust',
    name: 'Hip thrust',
    dose: '8–12 tekrar',
    how: [
      'Kürek kemikleri bench\'in kenarında, bar ya da ağır dambıl kalçanın üstünde (ped koy).',
      'Çene içeride, kaburga aşağıda. Kalçayı kilitle, 1–2 saniye tut.',
    ],
    cue: 'Tepede bel düz olacak. Kavisle yaparsan düzeltmeye çalıştığın şeyi pekiştirirsin.',
  },
  split: {
    id: 'split',
    name: 'Bulgarian split squat',
    dose: '8 tekrar / taraf',
    how: [
      'Arka ayak bench\'te, ön ayak bir adım önde.',
      'Kaburga aşağı, arka kalça sıkılı; gövde dik, bel kavislenmeden in ve kalk.',
    ],
    cue: 'Pozisyonu koruyabildiğin derinliğe kadar in.',
  },
  singleThrust: {
    id: 'singleThrust',
    name: 'Tek bacak hip thrust',
    dose: '8 tekrar / taraf',
    how: [
      'Kürek kemikleri bench\'te, bir ayak yerde, diğer diz göğse yakın.',
      'Kalçayı kilitle, pelvis düz kalsın, yana düşmesin.',
    ],
    cue: 'Tepede bel düz, kalça sıkışık.',
  },
};

export interface Phase {
  wk: string;
  name: string;
  from: number;
  to: number;
  text: string;
}

export const PHASES: Phase[] = [
  { wk: 'Hafta 1–2', name: 'Pozisyonu bul', from: 1, to: 14, text: 'Sadece çekirdek rutin. Amaç ağırlık değil — posterior tilt\'i isteyerek bulabilmek.' },
  { wk: 'Hafta 3–4', name: 'Tekrarı artır', from: 15, to: 28, text: 'Reverse crunch ve couch stretch girer, glute bridge 3 sete çıkar. Her ayağa kalkışta bir nefes ver, kaburgayı indir.' },
  { wk: 'Hafta 5–6', name: 'Yüklen', from: 29, to: 42, text: 'Bridge yerine hip thrust, dead bug\'a dambıl, Pallof press ya da yan plank girer. Esnetme kısalır.' },
  { wk: 'Hafta 7–8', name: 'Ayağa taşı', from: 43, to: 56, text: 'Tek bacak işi, pozisyon korunarak. Rutin artık ısınma gibi — asıl kontrol gün içinde.' },
];

export const PROGRAM_DAYS = 56;
export const MEASURE_DAYS = [1, 28, 56];

export const TESTS = [
  { id: 'T1', name: 'Duvar testi', text: 'Sırt duvarda, topuklar ~8 cm önde. Elini belinle duvar arasına kaydır. Yumruk rahat geçiyorsa belirgin öne eğim var.' },
  { id: 'T2', name: 'Yandan fotoğraf', text: 'Rahat duruşta, poz vermeden yandan boydan fotoğraf. Aynı yer, aynı ışık, aynı saat.' },
  { id: 'T3', name: 'Thomas testi', text: 'Bench ucunda sırtüstü, bir dizini göğsüne çek. Serbest uyluk bench hizasının altına inmiyorsa kalça fleksörü kısa.' },
  { id: 'T4', name: 'Kontrol testi', text: 'Sırtüstü, dizler bükülü. Nefes vererek beli eline bastırabiliyor musun — sadece karınla?' },
];

/** Program day (1-based) for `today`; days past 56 keep the last phase. */
export function programDay(startDate: DateKey, today: DateKey): number {
  return Math.max(1, daysBetween(startDate, today) + 1);
}

export function phaseFor(day: number): Phase {
  const d = Math.min(day, PROGRAM_DAYS);
  return PHASES.find((p) => d >= p.from && d <= p.to) ?? PHASES[PHASES.length - 1];
}

export type TiltStep =
  | { kind: 'breath'; ex: Exercise; rounds: number; breaths: number }
  | { kind: 'hold'; ex: Exercise; seconds: number; sides: string[] }
  | { kind: 'reps'; ex: Exercise; sets: number; reps: string; rest: number };

const sides = (n: number) => Array.from({ length: n }, () => ['Sağ', 'Sol']).flat();

export function routineFor(day: number): TiltStep[] {
  const p = PHASES.indexOf(phaseFor(day));
  const E = EXERCISES;
  const steps: TiltStep[] = [{ kind: 'breath', ex: E.breath, rounds: 3, breaths: 5 }];

  if (p === 0) {
    steps.push({ kind: 'hold', ex: E.flexor, seconds: 30, sides: sides(2) });
    steps.push({ kind: 'reps', ex: E.bridge, sets: 2, reps: '10–12', rest: 30 });
    steps.push({ kind: 'reps', ex: E.deadbug, sets: 2, reps: '8 / taraf', rest: 30 });
  } else if (p === 1) {
    steps.push({ kind: 'hold', ex: E.flexor, seconds: 30, sides: sides(2) });
    steps.push({ kind: 'hold', ex: E.couch, seconds: 30, sides: sides(1) });
    steps.push({ kind: 'reps', ex: E.bridge, sets: 3, reps: '10–12', rest: 30 });
    steps.push({ kind: 'reps', ex: E.deadbug, sets: 2, reps: '8 / taraf', rest: 30 });
    steps.push({ kind: 'reps', ex: E.reverse, sets: 2, reps: '10–12', rest: 30 });
  } else if (p === 2) {
    steps.push({ kind: 'hold', ex: E.flexor, seconds: 30, sides: sides(1) });
    steps.push({ kind: 'hold', ex: E.couch, seconds: 30, sides: sides(1) });
    steps.push({ kind: 'reps', ex: E.thrust, sets: 3, reps: '8–12', rest: 45 });
    steps.push({ kind: 'reps', ex: E.deadbugW, sets: 2, reps: '8 / taraf', rest: 30 });
    steps.push({ kind: 'reps', ex: E.pallof, sets: 2, reps: '10 / taraf', rest: 30 });
  } else {
    steps.push({ kind: 'hold', ex: E.flexor, seconds: 30, sides: sides(1) });
    steps.push({ kind: 'reps', ex: E.split, sets: 2, reps: '8 / taraf', rest: 45 });
    steps.push({ kind: 'reps', ex: E.singleThrust, sets: 2, reps: '8 / taraf', rest: 30 });
    steps.push({ kind: 'reps', ex: E.deadbugW, sets: 2, reps: '8 / taraf', rest: 30 });
    steps.push({ kind: 'reps', ex: E.pallof, sets: 2, reps: '10 / taraf', rest: 30 });
  }
  return steps;
}

/** Breath pacer: 4 s in, 8 s out, 3 s empty. */
export const BREATH = [
  { label: 'Burundan al', sec: 4, scale: 1 },
  { label: 'Ağızdan ver', sec: 8, scale: 0.55 },
  { label: 'Boşalt', sec: 3, scale: 0.45 },
];
