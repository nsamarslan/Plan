import { useSyncExternalStore } from 'react';
let toasts = [];
let seq = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
export function toast(t, ms = 6000) {
    const id = ++seq;
    toasts = [...toasts, { ...t, id }];
    emit();
    setTimeout(() => dismiss(id), ms);
}
export function dismiss(id) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
}
export function useToasts() {
    return useSyncExternalStore((l) => {
        listeners.add(l);
        return () => listeners.delete(l);
    }, () => toasts);
}
