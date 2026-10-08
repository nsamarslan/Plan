import { isNative, PlanNative } from '../native/plan';
import type { AudioSettings } from '../model/types';
import { getAudio } from './db';

// Background music (looped) + spoken awareness cues at random intervals.
// Short music clips get a crossfade baked into the loop so they repeat
// without a seam; the voice ducks the music while it speaks.

const CROSSFADE_SEC = 2.5;
const SHORT_CLIP_SEC = 90;

class FocusAudioEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private music: AudioBufferSourceNode | null = null;
  private musicTrack = 0;
  /** Bumped on every stop; a load that finishes under an old generation is dropped. */
  private musicGen = 0;
  private clip: AudioBufferSourceNode | null = null;
  private voiceGen = 0;
  /** Files that are not on this device (ids sync, files don't). */
  private missing = new Set<string>();
  private cueTimer: ReturnType<typeof setTimeout> | undefined;
  private buffers = new Map<string, AudioBuffer>();
  private settings: AudioSettings | null = null;
  private blockLabel = '';
  private running = false;
  private speaking = false;
  private lastPhrase = -1;

  get isRunning() {
    return this.running;
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.musicGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.voiceGain.connect(this.ctx.destination);
      // Browsers only allow audio after a tap; resume on the first one.
      const unlock = () => void this.ctx?.resume();
      document.addEventListener('pointerdown', unlock, { passive: true });
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  start(settings: AudioSettings, blockLabel: string) {
    if (this.running) {
      this.update(settings, blockLabel);
      return;
    }
    this.settings = settings;
    this.blockLabel = blockLabel;
    this.running = true;
    this.ensureCtx();
    this.applyVolumes();
    if (settings.musicEnabled && settings.musicIds.length) void this.playMusic();
    if (settings.voiceEnabled) this.scheduleCue();
  }

  /** Settings changed while running. */
  update(settings: AudioSettings, blockLabel: string) {
    const prev = this.settings;
    this.settings = settings;
    this.blockLabel = blockLabel;
    if (!this.running) return;
    this.applyVolumes();
    const musicChanged =
      !prev || prev.musicEnabled !== settings.musicEnabled || prev.musicIds.join() !== settings.musicIds.join();
    if (musicChanged || prev?.clipIds.join() !== settings.clipIds.join()) this.missing.clear();
    if (musicChanged) {
      this.stopMusic();
      if (settings.musicEnabled && settings.musicIds.length) void this.playMusic();
    }
    const cueChanged =
      !prev || prev.voiceEnabled !== settings.voiceEnabled || prev.minSec !== settings.minSec || prev.maxSec !== settings.maxSec;
    if (cueChanged) {
      clearTimeout(this.cueTimer);
      if (settings.voiceEnabled) this.scheduleCue();
    }
  }

  stop() {
    this.running = false;
    clearTimeout(this.cueTimer);
    this.stopMusic();
    this.stopVoice();
  }

  private stopVoice() {
    this.voiceGen++;
    const c = this.clip;
    this.clip = null;
    try {
      c?.stop();
    } catch {
      /* not started yet or already stopped */
    }
    if (isNative) void PlanNative.stopSpeaking().catch(() => {});
    else window.speechSynthesis?.cancel();
  }

  private applyVolumes() {
    if (!this.ctx || !this.settings) return;
    const t = this.ctx.currentTime;
    this.musicGain!.gain.setTargetAtTime(this.speaking ? this.settings.musicVolume * 0.3 : this.settings.musicVolume, t, 0.1);
    this.voiceGain!.gain.setTargetAtTime(this.settings.voiceVolume, t, 0.05);
  }

  private async loadBuffer(id: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return cached;
    const file = await getAudio(id);
    if (!file) {
      this.missing.add(id);
      return null;
    }
    const ctx = this.ensureCtx();
    try {
      const buf = await ctx.decodeAudioData(await file.blob.arrayBuffer());
      this.buffers.set(id, buf);
      return buf;
    } catch {
      this.missing.add(id);
      return null;
    }
  }

  /** Loop buffer whose tail is crossfaded into its head: plays seamlessly with loop=true. */
  private bakeLoop(buf: AudioBuffer): AudioBuffer {
    const ctx = this.ensureCtx();
    const fade = Math.min(CROSSFADE_SEC, buf.duration / 4);
    const fadeN = Math.floor(fade * buf.sampleRate);
    const len = buf.length - fadeN;
    if (len <= fadeN) return buf;
    const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const src = buf.getChannelData(ch);
      const dst = out.getChannelData(ch);
      dst.set(src.subarray(0, len));
      // Head of the loop = original head faded in + original tail faded out.
      for (let i = 0; i < fadeN; i++) {
        const x = i / fadeN;
        const fadeIn = Math.sin((x * Math.PI) / 2);
        const fadeOut = Math.cos((x * Math.PI) / 2);
        dst[i] = src[i] * fadeIn + src[len + i] * fadeOut;
      }
    }
    return out;
  }

  private async playMusic() {
    const s = this.settings;
    if (!s || !this.running) return;
    const gen = this.musicGen;
    const ids = s.musicIds;
    // Skip files that aren't on this device instead of going silent.
    let buf: AudioBuffer | null = null;
    for (let tries = 0; tries < ids.length && !buf; tries++) {
      const id = ids[this.musicTrack % ids.length];
      buf = this.missing.has(id) ? null : await this.loadBuffer(id);
      if (gen !== this.musicGen || !this.running) return; // stopped or changed meanwhile
      if (!buf) this.musicTrack++;
    }
    if (!buf) return;
    const ctx = this.ensureCtx();
    const src = ctx.createBufferSource();
    const single = ids.filter((id) => !this.missing.has(id)).length <= 1;
    if (single) {
      src.buffer = buf.duration <= SHORT_CLIP_SEC ? this.bakeLoop(buf) : buf;
      src.loop = true;
    } else {
      src.buffer = buf;
      src.onended = () => {
        if (this.music !== src || !this.running) return;
        this.musicTrack++;
        void this.playMusic();
      };
    }
    src.connect(this.musicGain!);
    src.start();
    this.music = src;
  }

  private stopMusic() {
    this.musicGen++;
    const m = this.music;
    this.music = null;
    try {
      m?.stop();
    } catch {
      /* already stopped */
    }
  }

  private scheduleCue() {
    const s = this.settings;
    if (!s) return;
    const min = Math.max(5, Math.min(s.minSec, s.maxSec));
    const max = Math.max(min, s.maxSec);
    const delay = (min + Math.random() * (max - min)) * 1000;
    clearTimeout(this.cueTimer);
    this.cueTimer = setTimeout(() => {
      void this.cueNow().finally(() => {
        if (this.running && this.settings?.voiceEnabled) this.scheduleCue();
      });
    }, delay);
  }

  /** Say one random phrase (or play one voice clip) right now. */
  async cueNow(): Promise<void> {
    const s = this.settings;
    if (!s) return;
    const phrases = s.phrases.filter((p) => p.enabled && p.text.trim());
    const pool: ({ kind: 'text'; text: string } | { kind: 'clip'; id: string })[] = [
      ...phrases.map((p) => ({ kind: 'text' as const, text: p.text })),
      ...s.clipIds.map((id) => ({ kind: 'clip' as const, id })),
    ];
    if (!pool.length) return;
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === this.lastPhrase) i = (i + 1) % pool.length;
    this.lastPhrase = i;
    const pick = pool[i];
    this.speaking = true;
    this.applyVolumes();
    try {
      if (pick.kind === 'clip') await this.playClip(pick.id);
      else await this.say(pick.text.replace(/\{(block|blok)\}/gi, this.blockLabel || 'the task'));
    } finally {
      this.speaking = false;
      this.applyVolumes();
    }
  }

  private async playClip(id: string): Promise<void> {
    const gen = this.voiceGen;
    const buf = await this.loadBuffer(id);
    if (!buf || gen !== this.voiceGen) return;
    const ctx = this.ensureCtx();
    await new Promise<void>((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.voiceGain!);
      src.onended = () => {
        if (this.clip === src) this.clip = null;
        resolve();
      };
      this.clip = src;
      src.start(ctx.currentTime + 0.3);
      // Never wait forever (e.g. the context got suspended).
      setTimeout(resolve, (buf.duration + 2) * 1000);
    });
  }

  private say(text: string): Promise<void> {
    const s = this.settings!;
    if (isNative) {
      // Never wait forever: a stuck speech engine must not leave music ducked and cues stopped.
      return Promise.race([
        PlanNative.speak({ text, lang: s.lang, rate: s.rate, pitch: s.pitch, volume: s.voiceVolume, voice: s.voiceName || undefined }).catch(
          () => {},
        ),
        new Promise<void>((r) => setTimeout(r, 15_000)),
      ]);
    }
    const synth = window.speechSynthesis;
    if (!synth) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = s.lang;
      u.rate = s.rate;
      u.pitch = s.pitch;
      u.volume = s.voiceVolume;
      const v = synth.getVoices().find((x) => x.name === s.voiceName);
      if (v) u.voice = v;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
      setTimeout(resolve, 15_000);
    });
  }
}

export const focusAudio = new FocusAudioEngine();

/** Speak one phrase immediately with the given settings (for the "Dinle" button). */
export async function previewCue(settings: AudioSettings, label: string) {
  focusAudio.update(settings, label);
  await focusAudio.cueNow();
}
