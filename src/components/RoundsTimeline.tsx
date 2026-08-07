import { Laptop, MapPin, Calendar, CheckCircle2 } from 'lucide-react';
import { parseISO, isAfter, isBefore } from 'date-fns';
import type { Round } from '@/types/hackathon';

interface RoundsTimelineProps {
  rounds: Round[];
}

export default function RoundsTimeline({ rounds }: RoundsTimelineProps) {
  if (!rounds || rounds.length === 0) {
    return (
      <div className="p-4 bg-zinc-900/20 border border-zinc-800 rounded-2xl text-center">
        <p className="text-sm text-zinc-500 font-mono">No timeline rounds specified for this hackathon.</p>
      </div>
    );
  }

  const now = new Date();

  // Helper to format dates nicely
  const formatDateRange = (startStr: string, endStr: string) => {
    try {
      const start = parseISO(startStr);
      const end = parseISO(endStr);
      const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endFmt = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startFmt} — ${endFmt}`;
    } catch {
      return `${startStr} — ${endStr}`;
    }
  };

  // Helper to determine status: 'upcoming', 'current', or 'completed'
  const getRoundStatus = (startStr: string, endStr: string) => {
    try {
      const start = parseISO(startStr);
      const end = parseISO(endStr);

      if (isAfter(start, now)) {
        return 'upcoming';
      }
      if (isBefore(end, now)) {
        return 'completed';
      }
      return 'current';
    } catch {
      return 'upcoming';
    }
  };

  return (
    <div className="w-full relative pl-6 border-l border-zinc-800 space-y-6 py-2">
      {rounds.map((round, index) => {
        const status = getRoundStatus(round.start_date, round.end_date);
        const isCurrent = status === 'current';
        const isCompleted = status === 'completed';

        return (
          <div key={index} className="relative group">
            
            {/* Timeline Dot Indicator */}
            <span className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${
              isCurrent 
                ? 'bg-accent-primary border-violet-400 ring-4 ring-accent-primary/20 scale-110 shadow-lg shadow-violet-950/50'
                : isCompleted
                  ? 'bg-zinc-800 border-zinc-700'
                  : 'bg-zinc-950 border-zinc-800'
            }`}>
              {isCompleted && <CheckCircle2 size={10} className="text-zinc-500" />}
              {isCurrent && <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />}
            </span>

            {/* Content Container */}
            <div className={`p-4 rounded-xl border transition-all ${
              isCurrent 
                ? 'bg-zinc-900 border-accent-primary/60 shadow-md shadow-violet-950/10'
                : 'bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-750'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {round.type === 'online' ? (
                    <Laptop size={14} className="text-cyan-400" />
                  ) : (
                    <MapPin size={14} className="text-amber-400" />
                  )}
                  <h4 className={`text-sm font-bold tracking-wide uppercase ${isCurrent ? 'text-zinc-100' : 'text-zinc-300'}`}>
                    {round.name}
                  </h4>
                </div>

                {/* Status Indicator text badge */}
                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider self-start sm:self-auto ${
                  isCurrent
                    ? 'text-violet-400 bg-violet-950/40 border border-violet-500/20'
                    : isCompleted
                      ? 'text-zinc-500 bg-zinc-800/40 border border-zinc-700/10'
                      : 'text-zinc-500 bg-zinc-900/40 border border-zinc-800/20'
                }`}>
                  {status}
                </span>
              </div>

              {/* Date timeline details */}
              <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-zinc-600" />
                  <span>{formatDateRange(round.start_date, round.end_date)}</span>
                </div>

                {round.type === 'offline' && round.location && (
                  <div className="flex items-center gap-1.5 pt-0.5 text-zinc-400">
                    <MapPin size={12} className="text-zinc-500" />
                    <span>{round.location}</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })}
    </div>
  );
}
