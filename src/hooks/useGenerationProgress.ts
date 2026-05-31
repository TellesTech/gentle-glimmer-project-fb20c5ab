import { useEffect, useRef, useState } from 'react';

/**
 * Hook for long-running AI generation UX:
 * - Simulated continuous progress that climbs to `cap` (never gets stuck visually)
 * - Elapsed time counter (mm:ss)
 *
 * Call `start()` when the request begins, `complete()` when it finishes,
 * and `reset()` to clear. The `progress` and `elapsed` values can be bound
 * to a Progress bar and a label.
 */
export function useGenerationProgress(opts?: { cap?: number; tickMs?: number; stepPercent?: number }) {
  const cap = opts?.cap ?? 90;
  const tickMs = opts?.tickMs ?? 1200;
  const stepPercent = opts?.stepPercent ?? 1;

  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0); // seconds
  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stopTimers = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const start = () => {
    stopTimers();
    setProgress(5);
    setElapsed(0);
    startedAtRef.current = Date.now();
    intervalRef.current = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
      setProgress((p) => (p < cap ? Math.min(cap, p + stepPercent) : p));
    }, tickMs);
  };

  const complete = () => {
    stopTimers();
    setProgress(100);
  };

  const reset = () => {
    stopTimers();
    setProgress(0);
    setElapsed(0);
    startedAtRef.current = null;
  };

  useEffect(() => () => stopTimers(), []);

  const elapsedLabel = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return { progress, elapsed, elapsedLabel, start, complete, reset, setProgress };
}
