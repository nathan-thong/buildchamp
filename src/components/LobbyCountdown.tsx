import { useEffect, useState } from 'react';

export function useRemainingSeconds(deadlineAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadlineAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);
  return deadlineAt === null ? null : Math.max(0, Math.ceil((deadlineAt - now) / 1_000));
}

export function formatCountdown(seconds: number | null): string {
  if (seconds === null) return '—:—';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
