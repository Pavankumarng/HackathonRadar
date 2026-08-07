import type { Hackathon } from '@/types/hackathon';
import CountdownBadge from './CountdownBadge';
import { ExternalLink, Calendar, Users, Layers, MapPin } from 'lucide-react';

interface HackathonCardProps {
  hackathon: Hackathon;
}

const HACKER_QUOTES = [
  "Talk is cheap. Show me the code.",
  "Programs must be written for people to read.",
  "Any fool can write code that a computer can understand.",
  "First, solve the problem. Then, write the code.",
  "Experience is the name everyone gives to their mistakes.",
  "Code is like humor. When you have to explain it, it's bad.",
  "Fix the cause, not the symptom.",
  "Make it work, make it right, make it fast.",
  "Simplicity is the soul of efficiency.",
  "Before software can be reusable it first has to be usable."
];

export default function HackathonCard({ hackathon }: HackathonCardProps) {
  const {
    title,
    source_site,
    source_url,
    mode,
    prize_pool,
    team_size,
    banner_url,
    tags = [],
    registration_end,
    rounds = [],
    venue_city,
    venue_state,
  } = hackathon;

  // 1. Fallback Gradient styling based on platform theme
  const getFallbackGradient = (source: string) => {
    switch (source) {
      case 'devfolio':
        return 'from-violet-950 via-purple-900 to-indigo-950';
      case 'unstop':
        return 'from-orange-950 via-amber-900 to-yellow-950';
      case 'hackerearth':
        return 'from-blue-950 via-sky-900 to-indigo-950';
      case 'devpost':
        return 'from-green-950 via-emerald-900 to-teal-950';
      case 'hackculture':
        return 'from-pink-950 via-fuchsia-900 to-purple-950';
      default:
        return 'from-zinc-950 via-zinc-900 to-zinc-950';
    }
  };

  // 2. Source Badge styling
  const getSourceBadgeStyle = (source: string) => {
    switch (source) {
      case 'devfolio':
        return 'text-purple-400 bg-purple-950/40 border-purple-500/20';
      case 'unstop':
        return 'text-orange-400 bg-orange-950/40 border-orange-500/20';
      case 'hackerearth':
        return 'text-blue-400 bg-blue-950/40 border-blue-500/20';
      case 'devpost':
        return 'text-green-400 bg-green-950/40 border-green-500/20';
      case 'hackculture':
        return 'text-pink-400 bg-pink-950/40 border-pink-500/20';
      default:
        return 'text-zinc-400 bg-zinc-950/40 border-zinc-500/20';
    }
  };

  // 3. Mode Badge styling
  const getModeBadgeStyle = (m?: string | null) => {
    switch (m) {
      case 'online':
        return 'text-[var(--accent-secondary)] bg-[var(--accent-secondary)]/10 border-[var(--accent-secondary)]/20';
      case 'offline':
        return 'text-[var(--accent-offline)] bg-[var(--accent-offline)]/10 border-[var(--accent-offline)]/20';
      case 'hybrid':
        return 'text-[var(--accent-hybrid)] bg-[var(--accent-hybrid)]/10 border-[var(--accent-hybrid)]/20';
      default:
        return 'text-zinc-400 bg-zinc-950/30 border-zinc-500/20';
    }
  };

  const roundedCount = Array.isArray(rounds) ? rounds.length : 0;
  const displayTags = (tags || []).slice(0, 3);
  
  // Deterministic random quote based on title length
  const quoteIndex = (title.length + (source_site.length)) % HACKER_QUOTES.length;
  const summaryText = HACKER_QUOTES[quoteIndex];

  return (
    <div className="group relative rounded-xl overflow-hidden flex flex-col h-full bg-bg-card border border-border transition-all duration-300 hover:border-accent-primary/50 hover:bg-bg-card-hover hover:shadow-[0_0_20px_var(--border-glow)]">
      
      {/* Banner / Card Header - GRADIENT ONLY */}
      <div className="relative h-40 w-full overflow-hidden border-b border-border-strong bg-zinc-950">
        <div className={`w-full h-full bg-gradient-to-br ${getFallbackGradient(source_site)} flex items-center justify-center p-6 text-center transition-transform duration-700 group-hover:scale-105`}>
          <span className="font-extrabold text-sm tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 select-none uppercase">
            {source_site.replace('hackerearth', 'hacker earth')}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent pointer-events-none" />
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

        {/* Source and Countdown Badges floating over image */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10 pointer-events-none">
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border tracking-wider pointer-events-auto ${getSourceBadgeStyle(source_site)}`}>
            {source_site}
          </span>
          <div className="pointer-events-auto">
            <CountdownBadge deadline={registration_end} />
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex flex-col flex-1">
        
        {/* Badges row: Mode & Rounds */}
        <div className="flex gap-2 mb-3">
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border tracking-wider flex items-center gap-1 ${getModeBadgeStyle(mode)}`}>
            {mode === 'online' ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-secondary)] animate-pulse" /> : null}
            {mode || 'online'}
          </span>
          {roundedCount > 0 && (
            <span className="text-[10px] font-bold text-text-secondary bg-bg-base/50 border border-border px-2 py-0.5 rounded tracking-wider flex items-center gap-1">
              <Layers size={10} />
              {roundedCount} {roundedCount === 1 ? 'round' : 'rounds'}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-text-primary line-clamp-1 mb-2 hover:text-white transition-colors" title={title}>
          {title}
        </h3>

        {/* AI Summary Section */}
        <p className="text-xs text-text-secondary line-clamp-2 mb-4 leading-relaxed flex-1">
          {summaryText}
        </p>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] text-text-muted font-mono mb-4 border-t border-border pt-4">
          <div className="flex items-center gap-1.5">
            <Users size={11} className="text-text-muted" />
            <span className="truncate">{team_size || '1 - 4 members'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={11} className="text-text-muted" />
            <span className="truncate">Prize: {prize_pool || 'N/A'}</span>
          </div>
          {mode !== 'online' && (venue_city || venue_state) && (
            <div className="flex items-center gap-1.5 col-span-2">
              <MapPin size={11} className="text-text-muted" />
              <span className="truncate">{[venue_city, venue_state].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>

        {/* Footer: Tags & Button */}
        <div className="mt-auto pt-3 border-t border-border flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Tags */}
          <div className="flex gap-1.5 truncate overflow-hidden">
            {displayTags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-text-secondary bg-bg-base border border-border px-1.5 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Action Button */}
          <a
            href={source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-accent-primary hover:bg-[#6D28D9] transition-colors rounded-lg w-full sm:w-auto text-center shadow-[0_0_10px_var(--border-glow)]"
          >
            Visit Hackathon
            <ExternalLink size={12} />
          </a>
        </div>

      </div>
    </div>
  );
}
