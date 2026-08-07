import type { Hackathon } from '@/types/hackathon';
import HackathonCard from './HackathonCard';

interface HackathonGridProps {
  hackathons: Hackathon[];
  isLoading?: boolean;
}

export default function HackathonGrid({ hackathons, isLoading = false }: HackathonGridProps) {
  
  // 1. Render Skeleton loader (8 cards) with shimmering pulse animation
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-bg-card border border-border rounded-2xl overflow-hidden h-[380px] flex flex-col shimmer-mask"
          >
            {/* Banner shimmer */}
            <div className="h-40 bg-zinc-950/80 border-b border-border relative shimmer-mask" />
            
            {/* Body shimmer */}
            <div className="p-5 flex flex-col flex-1 space-y-4">
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-bg-card-hover rounded border border-border" />
                <div className="h-5 w-20 bg-bg-card-hover rounded border border-border" />
              </div>
              <div className="h-6 w-3/4 bg-bg-card-hover rounded" />
              <div className="space-y-2 flex-1 pt-2">
                <div className="h-4 w-full bg-bg-card-hover rounded" />
                <div className="h-4 w-5/6 bg-bg-card-hover rounded" />
              </div>
              <div className="h-10 w-full bg-bg-card-hover rounded-xl mt-4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 2. Render Empty state
  if (hackathons.length === 0) {
    return (
      <div className="w-full text-center py-20 bg-bg-card/30 border border-dashed border-border-strong rounded-3xl p-8 max-w-lg mx-auto">
        <h3 className="text-xl font-bold text-text-primary mb-2">No Active Hackathons Found</h3>
        <p className="text-text-muted text-sm">
          No events match the selected filters. Try adjusting your search query, mode, or source selections.
        </p>
      </div>
    );
  }

  // 3. Render Grid of cards
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
      {hackathons.map((hackathon) => (
        <HackathonCard key={hackathon.id} hackathon={hackathon} />
      ))}
    </div>
  );
}
