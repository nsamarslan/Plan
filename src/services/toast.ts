import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  color?: string;
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: Omit<Toast, 'id'>, ms = 6000) {
  const id = ++seq;
  toasts = [...toasts, { ...t, id }];
  emit();
  setTimeout(() => dismiss(id), ms);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
}
