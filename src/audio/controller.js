import { useEffect, useSyncExternalStore } from 'react';
import { focusAudio } from './engine';
// Decides when the background music + spoken cues run. The user can mute it
// for the current block from the Şimdi screen; the mute clears when the
// block changes.
let mutedFor = null;
/** "Hepsini test et" in Ayarlar: play now, whatever block is running. */
let testing = false;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const sub = (l) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};
export function setAudioMuted(key) {
    mutedFor = key;
    emit();
}
export function useAudioMuted() {
    return useSyncExternalStore(sub, () => mutedFor);
}
export function setAudioTest(on) {
    testing = on;
    emit();
}
export function useAudioTest() {
    return useSyncExternalStore(sub, () => testing);
}
export function audioWanted(settings, current, status) {
    const a = settings.audio;
    const hasSomething = a.voiceEnabled || (a.musicEnabled && a.musicIds.length > 0);
    if (!hasSomething)
        return false;
    if (a.when === 'always')
        return true;
    return !!current && status === 'active' && current.type.focusAudio;
}
export function useFocusAudioController(settings, current, status, dateKey, 
/** Pomodoro break: step away, so music and cues pause until the next focus. */
inBreak = false, 
/** A standalone pomodoro counts as a focus block. */
quick) {
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
        if (wanted)
            focusAudio.start(settings.audio, label);
        else
            focusAudio.stop();
    }, [wanted, label, settings.audio]);
    useEffect(() => () => focusAudio.stop(), []);
    return { wanted: planWanted, muted: muted === key, key };
}
