'use client';

import { useEffect, useState, useRef } from 'react';
import { Activity } from 'lucide-react';

interface StatsBarProps {
  total: number;
  online: number;
  offline: number;
}

// ─── Custom Count-Up component using requestAnimationFrame ────────────────
function CountUp({ value, duration = 600 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const startRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const startTime = performance.now();
    const startVal = startRef.current;
    const targetVal = value;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (easeOutQuad)
      const easeProgress = progress * (2 - progress);
      const currentVal = Math.round(startVal + (targetVal - startVal) * easeProgress);

      setCount(currentVal);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(targetVal);
        startRef.current = targetVal;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration]);

  return <span className="font-mono">{count}</span>;
}

export default function StatsBar({ total, online, offline }: StatsBarProps) {
  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-bg-card/30 border border-border rounded-2xl backdrop-blur-md shadow-[0_0_15px_var(--border-glow)]">
        
        {/* Total stats */}
        <div className="flex flex-col p-3 border-r border-border last:border-0">
          <span className="text-[10px] font-bold text-text-muted font-mono tracking-wider uppercase">Active Hackathons</span>
          <div className="text-3xl font-bold text-text-primary mt-1">
            <CountUp value={total} />
          </div>
        </div>

        {/* Online */}
        <div className="flex flex-col p-3 border-r border-border last:border-0">
          <span className="text-[10px] font-bold text-text-muted font-mono tracking-wider uppercase flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-secondary)]" /> Online
          </span>
          <div className="text-2xl font-bold text-[var(--accent-secondary)] mt-1">
            <CountUp value={online} />
          </div>
        </div>

        {/* Offline/Hybrid */}
        <div className="flex flex-col p-3 border-r border-border md:border-r last:border-0 border-r-0">
          <span className="text-[10px] font-bold text-text-muted font-mono tracking-wider uppercase flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-offline)]" /> In-Person
          </span>
          <div className="text-2xl font-bold text-[var(--accent-offline)] mt-1">
            <CountUp value={offline} />
          </div>
        </div>

        {/* Live Indicator */}
        <div className="flex flex-col items-start justify-center p-3 pl-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10">
            <Activity size={14} className="text-accent-primary animate-pulse" />
            <span className="text-xs font-bold font-mono tracking-wider text-accent-primary uppercase">
              System Live
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
