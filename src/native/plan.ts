import { Capacitor, registerPlugin } from '@capacitor/core';
import type { FocusWindow, NotifyEvent, PlanSlot } from '../model/notify';

export interface PermissionState {
  notifications: boolean;
  exactAlarm: boolean;
  fullScreen: boolean;
  dnd: boolean;
  usage: boolean;
  overlay: boolean;
  battery: boolean;
}

export type PermissionName = keyof PermissionState;

export interface NativeAction {
  /** snooze: "+10 dk" before a block starts; extend: "+10 dk" at its end. */
  type: 'start' | 'skip' | 'done' | 'snooze' | 'extend' | 'unlock';
  itemKey?: string;
  at: number;
}

export interface FocusState {
  active: boolean;
  silence: boolean;
  lock: boolean;
  label?: string;
  endsAt?: number;
  suppressedUntil?: number;
}

export interface AppInfo {
  packageName: string;
  label: string;
}

export interface VoiceInfo {
  name: string;
  lang: string;
}

interface PlanNativePlugin {
  setSchedule(opts: { events: NotifyEvent[]; windows: FocusWindow[]; slots: PlanSlot[] }): Promise<void>;
  consumeActions(): Promise<{ actions: NativeAction[] }>;
  /** The tab a notification asked to open (once). */
  takeLaunchTab(): Promise<{ tab?: string }>;
  getPermissions(): Promise<PermissionState>;
  requestPermission(opts: { name: PermissionName }): Promise<void>;
  getFocusState(): Promise<FocusState>;
  unlockFocus(): Promise<void>;
  listApps(): Promise<{ apps: AppInfo[] }>;
  keepAwake(opts: { on: boolean }): Promise<void>;
  speak(opts: { text: string; lang: string; rate: number; pitch: number; volume: number; voice?: string }): Promise<void>;
  stopSpeaking(): Promise<void>;
  listVoices(): Promise<{ voices: VoiceInfo[] }>;
  saveFile(opts: { name: string; text: string }): Promise<{ path: string }>;
}

export const isNative = Capacitor.isNativePlatform();

export const PlanNative = registerPlugin<PlanNativePlugin>('PlanNative');

/** Package names that are always reachable while locked (handled natively too). */
export const BUILTIN_ALLOWED = ['Telefon ve arama ekranı', 'WhatsApp aramaları', 'Saat / alarm', 'Ana ekran'];
