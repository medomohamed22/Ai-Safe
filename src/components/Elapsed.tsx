import { useEffect, useState } from 'react';

// Honest progress (P3-03): a real elapsed clock for a running request —
// never an invented percentage or remaining-time estimate.
export function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(t);
  }, []);
  return <span dir="ltr">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>;
}
