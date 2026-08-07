'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { Hackathon } from '@/types/hackathon';
import StatsBar from './StatsBar';
import FilterBar from './FilterBar';
import HackathonGrid from './HackathonGrid';
import { Terminal, Shield, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';

interface HackathonDashboardProps {
  initialHackathons: Hackathon[];
  initialTotal: number;
  initialPage: number;
  initialTotalPages: number;
  initialStats: {
    total: number;
    online: number;
    offline: number;
  };
  lastUpdatedText: string;
}

export default function HackathonDashboard({
  initialHackathons,
  initialTotal,
  initialPage,
  initialTotalPages,
  initialStats,
  lastUpdatedText,
}: HackathonDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Client-side states for filtering
  const [hackathons, setHackathons] = useState<Hackathon[]>(initialHackathons);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(false);

  // Monitor URL search parameter changes and trigger fetch
  useEffect(() => {
    // Skip fetch on initial render if URL params are empty (SSR loaded initial data matches)
    const hasParams = searchParams.toString().length > 0;
    if (!hasParams) {
      setHackathons(initialHackathons);
      setTotal(initialTotal);
      setTotalPages(initialTotalPages);
      setStats(initialStats);
      return;
    }

    let active = true;

    async function fetchFilteredData() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/hackathons?${searchParams.toString()}`);
        if (!res.ok) throw new Error('API fetch failed');
        const json = await res.json();
        
        if (active) {
          setHackathons(json.hackathons);
          setTotal(json.total);
          setTotalPages(json.totalPages);
          if (json.stats) {
            setStats(json.stats);
          }
        }
      } catch (err) {
        console.error('Failed client filtering:', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    fetchFilteredData();

    return () => {
      active = false;
    };
  }, [searchParams, initialHackathons, initialTotal, initialTotalPages, initialStats]);

  const activePage = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;

  // Handle pagination transitions helper
  const handlePageChange = (newPage: number) => {
    const current = new URLSearchParams(searchParams.toString());
    current.set('page', newPage.toString());
    router.push(`${pathname}?${current.toString()}`);
  };

  // Clear all filters handler
  const handleClearFilters = () => {
    router.push(pathname);
  };

  return (
    <div className="flex flex-col min-h-screen text-zinc-100 font-sans pb-20">
      
      {/* Top Banner Status Bar */}
      <div className="w-full bg-zinc-950 border-b border-zinc-900/60 py-2.5 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[10px] font-mono text-zinc-500 tracking-wider">
          <div className="flex items-center gap-2">
            <Terminal size={12} className="text-accent-primary animate-pulse" />
            <span>MISSION CONTROL PANEL // ACTIVE CONSOLE MODE</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-650">
            <Shield size={11} />
            <span>RLS ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Hero Section - EDITORIAL LEFT ALIGNED */}
      <section className="max-w-6xl mx-auto w-full px-4 pt-16 pb-10 space-y-6">
        <div className="flex items-center gap-2.5">
          <span className="bg-accent-primary/20 border border-accent-primary/40 text-accent-primary text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md tracking-wider">
            {initialStats.total} HACKATHONS LIVE
          </span>
          <span className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">
            {lastUpdatedText}
          </span>
        </div>

        <div className="max-w-2xl space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-[1.05] bg-clip-text text-transparent bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-400">
            Every hackathon.<br />One place.
          </h1>
          <p className="text-sm md:text-base text-zinc-400 leading-relaxed">
            Live listings from Unstop, Devfolio, HackerEarth, Devpost, Internshala & HackCulture — updated every 12 hours.
          </p>
        </div>

        <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
          <span>No sign-up. Just hackathons.</span>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="mb-8">
        <StatsBar 
          total={stats.total} 
          online={stats.online} 
          offline={stats.offline} 
        />
      </section>

      {/* Filter Bar (Sticky Component) */}
      <FilterBar />

      {/* Main Hackathon Grid Container */}
      <main className="max-w-6xl mx-auto w-full px-4 pt-10 flex-1">
        
        {isLoading ? (
          <HackathonGrid hackathons={[]} isLoading={true} />
        ) : hackathons.length === 0 ? (
          /* Custom Empty State Illustration */
          <div className="w-full flex flex-col items-center justify-center text-center py-20 max-w-md mx-auto">
            {/* Simple Radar SVG */}
            <div className="relative mb-6">
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="50" stroke="#1E2433" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx="60" cy="60" r="35" stroke="#1E2433" strokeWidth="1" />
                <circle cx="60" cy="60" r="20" stroke="#1E2433" strokeWidth="1" />
                <circle cx="60" cy="60" r="5" fill="#475569" className="animate-pulse" />
                <line x1="60" y1="10" x2="60" y2="110" stroke="#1E2433" strokeWidth="0.5" />
                <line x1="10" y1="60" x2="110" y2="60" stroke="#1E2433" strokeWidth="0.5" />
                <path d="M60 25 A35 35 0 0 1 95 60" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-10">
                <span className="text-[9px] font-mono font-bold text-red-500/80 bg-red-950/20 border border-red-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                  No Signal
                </span>
              </div>
            </div>

            <h3 className="text-base font-bold text-zinc-300 mb-2">No Match Detected</h3>
            <p className="text-zinc-500 text-xs leading-relaxed mb-6">
              No hackathons match your active filters. Try resetting your query parameters to scan the database again.
            </p>
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-accent-primary hover:bg-violet-700 transition-colors rounded-xl font-mono uppercase tracking-wider"
            >
              <RotateCcw size={13} />
              Reset Console
            </button>
          </div>
        ) : (
          <HackathonGrid hackathons={hackathons} isLoading={false} />
        )}
        
        {/* Simple pagination links if multiple pages exist */}
        {!isLoading && totalPages > 1 && (
          <div className="w-full flex items-center justify-center gap-3 pt-12 border-t border-zinc-900/60 mt-16 font-mono text-[10px]">
            {activePage > 1 && (
              <button
                onClick={() => handlePageChange(activePage - 1)}
                className="px-4 py-2 border border-zinc-800 rounded-xl hover:border-zinc-700 bg-zinc-900/30 text-zinc-300 transition-all font-bold tracking-wider"
              >
                PREV PAGE
              </button>
            )}
            <span className="text-zinc-500 uppercase tracking-widest font-bold">
              PAGE {activePage} OF {totalPages}
            </span>
            {activePage < totalPages && (
              <button
                onClick={() => handlePageChange(activePage + 1)}
                className="px-4 py-2 border border-zinc-800 rounded-xl hover:border-zinc-700 bg-zinc-900/30 text-zinc-300 transition-all font-bold tracking-wider"
              >
                NEXT PAGE
              </button>
            )}
          </div>
        )}
      </main>

      {/* Tactical Footer */}
      <footer className="w-full border-t border-zinc-900/60 mt-24 py-8 px-4 text-center text-[10px] font-mono text-zinc-650 tracking-wider">
        <div className="max-w-6xl mx-auto space-y-1">
          <p className="text-zinc-500 uppercase">
            HackRadar · Data Aggregated from Unstop, Devfolio, HackerEarth, Devpost, Internshala, HackCulture
          </p>
          <p className="text-zinc-600">
            System running: Node Scraper (Playwright stealth module) · Updates automatically every 12 hours
          </p>
        </div>
      </footer>

    </div>
  );
}
