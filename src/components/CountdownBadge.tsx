'use client';

import { useState, useEffect } from 'react';
import { differenceInSeconds, parseISO } from 'date-fns';

interface CountdownBadgeProps {
  deadline: string;
}

export default function CountdownBadge({ deadline }: CountdownBadgeProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [colorClass, setColorClass] = useState<string>('text-emerald-400 border-emerald-500/30 bg-emerald-950/20');

  useEffect(() => {
    function updateCountdown() {
      const deadlineDate = parseISO(deadline);
      const totalSeconds = differenceInSeconds(deadlineDate, new Date());

      if (totalSeconds <= 0) {
        setTimeLeft('Closed');
        setColorClass('text-red-400 border-red-500/30 bg-red-950/20');
        return;
      }

      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);

      // Label structure
      let displayString = '';
      if (days > 0) {
        displayString = `${days}d ${hours}h left`;
      } else if (hours > 0) {
        displayString = `${hours}h ${minutes}m left`;
      } else {
        displayString = `${minutes}m left`;
      }
      setTimeLeft(displayString);

      // Color mapping
      const hoursLeft = totalSeconds / 3600;
      if (hoursLeft < 72) {
        // Red for less than 72 hours
        setColorClass('text-red-400 border-red-500/30 bg-red-950/20');
      } else if (hoursLeft < 168) {
        // Amber for less than 7 days
        setColorClass('text-amber-400 border-amber-500/30 bg-amber-950/20');
      } else {
        // Emerald otherwise
        setColorClass('text-emerald-400 border-emerald-500/30 bg-emerald-950/20');
      }
    }

    updateCountdown();

    // Update every minute (60,000ms)
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <div className={`px-2.5 py-1 text-xs font-semibold rounded-md border font-mono tracking-wide ${colorClass}`}>
      {timeLeft || 'Calculating...'}
    </div>
  );
}
