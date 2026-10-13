import { useEffect, useSyncExternalStore } from 'react';
import type { EffectiveStatus, ResolvedItem, Settings } from '../model/types';
import { focusAudio } from './engine';

// Decides when the background music + spoken cues run. The user can mute it
// for the current block from the Şimdi screen; the mute clears when the
// block changes.

let mutedFor: string | null = null;
/** "Hepsini test et" in Ayarlar: play now, whatever block is running. */
let testing = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const sub = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function setAudioMuted(key: string | null) {
  mutedFor = key;
  emit();
}

export function useAudioMuted(): string | null {
  return useSyncExternalStore(sub, () => mutedFor);
}

export function setAudioTest(on: boolean) {
  testing = on;
  emit();
}

export function useAudioTest(): boolean {
  return useSyncExternalStore(sub, () => testing);
}

export function audioWanted(settings: Settings, current: ResolvedItem | undefined, status: EffectiveStatus | undefined): boolean {
  const a = settings.audio;
  const hasSomething = a.voiceEnabled || (a.musicEnabled && a.musicIds.length > 0);
  if (!hasSomething) return false;
  if (a.when === 'always') return true;
  return !!current && status === 'active' && current.type.focusAudio;
}

export function useFocusAudioController(
  settings: Settings,
  current: ResolvedItem | undefined,
  status: EffectiveStatus | undefined,
  dateKey: string,
  /** Pomodoro break: step away, so music and cues pause until the next focus. */
  inBreak = false,
  /** A standalone pomodoro counts as a focus block. */
  quick?: { key: string; label: string; inBreak: boolean },
) {
  const muted = useAudioMuted();
  const test = useAudioTest();
  const a = settings.audio;
  const hasSomething = a.voiceEnabled || (a.musicEnabled && a.musicIds.length > 0);
  const key = quick ? quick.key : current ? `${dateKey}|${current.id}` : 'free';
  const planWanted = quick ? hasSomething : audioWanted(settings, current, status);
  const breakNow = quick ? quick.inBreak : inBreak;
  const wanted = (planWanted && muted !== key && !breakNow) || test;
  const label = quick ? quick.label : current?.label ?? (test ? 'DSA' : '');

  useEffect(() => {
    if (wanted) focusAudio.start(settings.audio, label);
    else focusAudio.stop();
  }, [wanted, label, settings.audio]);

  useEffect(() => () => focusAudio.stop(), []);

  return { wanted: planWanted, muted: muted === key, key };
}
