import { useEffect } from 'react';
import { isNative, PlanNative } from '../native/plan';

/** Keep the screen on while `on` (a block is running). */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    if (isNative) {
      void PlanNative.keepAwake({ on: true }).catch(() => {});
      return () => void PlanNative.keepAwake({ on: false }).catch(() => {});
    }
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
        if (cancelled) void lock?.release();
      } catch {
        /* not supported or denied */
      }
    };
    void acquire();
    const onVis = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, [on]);
}
