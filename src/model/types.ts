import type { DateKey, Minutes } from '../lib/time';

export type ArtKey =
  | 'tilt'
  | 'walk'
  | 'weights'
  | 'reading'
  | 'meditation'
  | 'dsa'
  | 'design'
  | 'ai'
  | 'review'
  | 'meal'
  | 'free'
  | 'sleep';

/**
 * How the "Şimdi" screen runs a block:
 * - timer: plain countdown
 * - pomodoro: 50 min focus / 10 min break cycles inside the block
 * - tilt: guided pelvis routine (step by step, with timers)
 * - meditation: breathing circle + countdown
 * - walk: countdown + "turn back" cue at half time
 */
export type BlockMode = 'timer' | 'pomodoro' | 'tilt' | 'meditation' | 'walk';

/** A kind of activity. Its behaviour (notifications, image, focus lock) is fixed;
 *  only *when* it happens lives in the plan. */
export interface BlockType {
  id: string;
  name: string;
  color: string;
  art: ArtKey;
  firstStep: string;
  mode: BlockMode;
  /** Counts toward adherence stats. Meals don't. */
  tracked: boolean;
  /** Default focus mode: silence notifications (calls still ring) + lock other apps. */
  dnd: boolean;
  /** pre-warning / start / reminder / end notifications */
  notify: boolean;
  /** Play background music + spoken cues automatically during this block. */
  focusAudio: boolean;
  /** Extra Android packages allowed while this block locks the phone. */
  allowedApps: string[];
  /** "Sıradaki" – what to pick up next time; shown on the Şimdi screen. */
  note: string;
  tips?: string[];
}

export interface TemplateItem {
  id: string;
  typeId: string;
  label?: string;
  start: Minutes;
  duration: number;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** Kept in "kötü gün" (minimal) mode. */
  minimal?: boolean;
  minimalDuration?: number;
  /** Overrides the block type's dnd default. */
  dnd?: boolean;
}

export interface ItemOverride {
  start?: Minutes;
  duration?: number;
  removed?: boolean;
  dnd?: boolean;
}

export type ItemStatus = 'pending' | 'active' | 'done' | 'skipped';

export interface ItemLog {
  status: ItemStatus;
  startedAt?: number;
  endedAt?: number;
}

/** One calendar day: only the differences from the weekly template. */
export interface DayDoc {
  date: DateKey;
  mode: 'normal' | 'minimal';
  overrides: Record<string, ItemOverride>;
  extras: TemplateItem[];
  logs: Record<string, ItemLog>;
}

export interface DndRange {
  id: string;
  label: string;
  start: Minutes;
  end: Minutes;
  days: number[];
  silence: boolean;
  lockApps: boolean;
  enabled: boolean;
}

export interface Phrase {
  id: string;
  text: string;
  enabled: boolean;
}

export interface AudioSettings {
  /** Spoken cues on/off */
  voiceEnabled: boolean;
  /** Background music on/off */
  musicEnabled: boolean;
  /** When to run: during blocks marked focusAudio, or whenever the app is open */
  when: 'focusBlocks' | 'always';
  minSec: number;
  maxSec: number;
  phrases: Phrase[];
  /** ids of imported voice clips (IndexedDB) that may be played as cues */
  clipIds: string[];
  /** ids of imported music files; played in order, looping */
  musicIds: string[];
  musicVolume: number;
  voiceVolume: number;
  lang: string;
  voiceName: string;
  rate: number;
  pitch: number;
}

export interface Settings {
  wake: Minutes;
  sleep: Minutes;
  preWarnMin: number;
  remindEveryMin: number;
  remindCount: number;
  dndRanges: DndRange[];
  /** Always-allowed packages while locked (phone + WhatsApp calls are built in). */
  allowedApps: string[];
  /** Blocks with focus mode also lock apps (not only silence). */
  lockAppsInDndBlocks: boolean;
  showStreak: boolean;
  tiltStartDate: DateKey;
  audio: AudioSettings;
  supabaseUrl?: string;
  supabaseKey?: string;
}

export interface ResolvedItem {
  id: string;
  typeId: string;
  type: BlockType;
  label: string;
  start: Minutes;
  end: Minutes;
  duration: number;
  dnd: boolean;
  log: ItemLog;
  extra: boolean;
  /** true when this day has a time/duration change compared to the template */
  moved: boolean;
}

export type EffectiveStatus = 'upcoming' | 'late' | 'active' | 'done' | 'skipped' | 'missed';
