import { useEffect, useSyncExternalStore } from 'react';
import type { EffectiveStatus, ResolvedItem, Settings } from '../model/types';
import { focusAudio } from './engine';

// Decides when the background music + spoken cues run. The user can mute it
// for the current block from the Şimdi screen; the mute clears when the
// block changes.

let mutedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setAudioMuted(key: string | null) {
  mutedFor = key;
  emit();
}

export function useAudioMuted(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mutedFor,
  );
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
) {
  const muted = useAudioMuted();
  const key = current ? `${dateKey}|${current.id}` : 'free';
  const wanted = audioWanted(settings, current, status) && muted !== key;
  const label = current?.label ?? '';

  useEffect(() => {
    if (wanted) focusAudio.start(settings.audio, label);
    else focusAudio.stop();
  }, [wanted, label, settings.audio]);

  useEffect(() => () => focusAudio.stop(), []);

  return { wanted: audioWanted(settings, current, status), muted: muted === key, key };
}
