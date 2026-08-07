'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Search, X, SlidersHorizontal, Sliders, CheckCircle } from 'lucide-react';

const SOURCES = ['unstop', 'devpost', 'hackculture'] as const;

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Mobile drawer open state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Local state for search to allow immediate typing before debounce
  const [searchVal, setSearchVal] = useState(searchParams.get('search') || '');

  // Get active filters from URL
  const activeMode = searchParams.get('mode') || 'all';
  const activeSort = searchParams.get('sort') || 'deadline_asc';
  
  // Parse multi-select sources from URL (e.g. source=devfolio,unstop)
  const activeSources = searchParams.get('source') 
    ? searchParams.get('source')!.split(',')
    : [];

  // Count active filters
  let activeFilterCount = 0;
  if (activeMode !== 'all') activeFilterCount++;
  if (activeSources.length > 0) activeFilterCount += activeSources.length;
  if (searchParams.get('search')) activeFilterCount++;
  if (activeSort !== 'deadline_asc') activeFilterCount++;

  // Helper to construct query string changes
  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const current = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(params)) {
        if (value === null) {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      }
      return current.toString();
    },
    [searchParams]
  );

  // Debounced search update
  useEffect(() => {
    const handler = setTimeout(() => {
      const currentSearch = searchParams.get('search') || '';
      if (searchVal !== currentSearch) {
        startTransition(() => {
          const query = createQueryString({ 
            search: searchVal ? searchVal : null,
            page: null // reset pagination on search
          });
          router.push(`${pathname}?${query}`);
        });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchVal, pathname, router, createQueryString, searchParams]);

  // Mode click handler
  const handleModeChange = (mode: string) => {
    startTransition(() => {
      const query = createQueryString({ 
        mode: mode === 'all' ? null : mode,
        page: null 
      });
      router.push(`${pathname}?${query}`);
    });
  };

  // Source toggle handler (multi-select)
  const handleSourceToggle = (source: string) => {
    let nextSources: string[];
    if (activeSources.includes(source)) {
      nextSources = activeSources.filter((s) => s !== source);
    } else {
      nextSources = [...activeSources, source];
    }

    startTransition(() => {
      const query = createQueryString({
        source: nextSources.length > 0 ? nextSources.join(',') : null,
        page: null
      });
      router.push(`${pathname}?${query}`);
    });
  };

  // Sort change handler
  const handleSortChange = (sort: string) => {
    startTransition(() => {
      const query = createQueryString({ sort });
      router.push(`${pathname}?${query}`);
    });
  };

  // Reset all filters
  const handleReset = () => {
    setSearchVal('');
    startTransition(() => {
      router.push(pathname);
    });
  };

  return (
    <>
      <div className="sticky top-0 z-40 w-full border-b border-border bg-bg-base/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4">
          
          {/* DESKTOP FILTER BAR */}
          <div className="hidden md:flex flex-col gap-4">
            {/* Search & Mode & Sort Row */}
            <div className="flex flex-row items-center justify-between gap-4">
              
              {/* Search box */}
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Search hackathons..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  className="w-full bg-bg-card/50 border border-border focus:border-accent-primary focus:ring-1 focus:ring-accent-primary text-text-primary text-sm rounded-xl pl-10 pr-4 py-2.5 transition-all outline-none"
                />
                {searchVal && (
                  <button
                    onClick={() => setSearchVal('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Mode Tabs */}
              <div className="flex bg-bg-card/40 border border-border p-1 rounded-xl">
                {['all', 'online', 'offline', 'hybrid'].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                      activeMode === m
                        ? 'bg-accent-primary text-white shadow-[0_0_10px_var(--border-glow)]'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Sorting */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-mono flex items-center gap-1">
                  <SlidersHorizontal size={12} />
                  SORT BY
                </span>
                <select
                  value={activeSort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="bg-bg-card/50 border border-border focus:border-accent-primary focus:ring-1 focus:ring-accent-primary text-text-secondary hover:text-text-primary text-xs font-bold uppercase rounded-xl px-3 py-2 cursor-pointer outline-none transition-all"
                >
                  <option value="deadline_asc">DEADLINE (SOONEST)</option>
                  <option value="deadline_desc">DEADLINE (LATEST)</option>
                  <option value="newest">NEWEST ADDED</option>
                </select>
              </div>

            </div>

            {/* Source select & Active Filters indicator */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-mono mr-1">SOURCES</span>
                {SOURCES.map((src) => {
                  const isSelected = activeSources.includes(src);
                  return (
                    <button
                      key={src}
                      onClick={() => handleSourceToggle(src)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all uppercase tracking-wide ${
                        isSelected
                          ? 'bg-zinc-900 border-accent-primary text-zinc-100 shadow-md shadow-violet-950/10'
                          : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-500 hover:border-zinc-750 hover:text-zinc-300'
                      }`}
                    >
                      {src}
                    </button>
                  );
                })}
              </div>

              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="bg-accent-primary/20 border border-accent-primary/30 text-accent-primary px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider">
                    {activeFilterCount} FILTER{activeFilterCount > 1 ? 'S' : ''} ACTIVE
                  </span>
                  <button
                    onClick={handleReset}
                    className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider flex items-center gap-1"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* MOBILE COLLAPSED LAYOUT */}
          <div className="flex md:hidden items-center justify-between gap-3">
            {/* Search Input (Takes majority space) */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Search..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-accent-primary text-zinc-200 text-sm rounded-xl pl-9 pr-8 py-2.5 outline-none"
              />
              {searchVal && (
                <button
                  onClick={() => setSearchVal('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase border border-zinc-800 bg-zinc-900/40 rounded-xl hover:border-zinc-700 text-zinc-300 transition-all relative"
            >
              <Sliders size={14} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-primary text-[8px] font-extrabold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE BOTTOM DRAWER SHEET OVERLAY */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          {/* Backdrop Click Closes Drawer */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setIsDrawerOpen(false)} />

          {/* Drawer Body */}
          <div className="relative w-full bg-zinc-950 border-t border-zinc-800/80 rounded-t-3xl max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl z-10 animate-in slide-in-from-bottom duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                <Sliders size={16} className="text-accent-primary" />
                Filter Console
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded-lg border border-zinc-850 hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mode selection block */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-zinc-500 font-mono tracking-wider uppercase">Event Mode</h4>
              <div className="grid grid-cols-4 gap-2 bg-zinc-900/30 border border-zinc-900 p-1 rounded-xl">
                {['all', 'online', 'offline', 'hybrid'].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all text-center ${
                      activeMode === m
                        ? 'bg-accent-primary text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Sources select block */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-zinc-500 font-mono tracking-wider uppercase">Platforms / Sources</h4>
              <div className="flex flex-col gap-2">
                {SOURCES.map((src) => {
                  const isSelected = activeSources.includes(src);
                  return (
                    <button
                      key={src}
                      onClick={() => handleSourceToggle(src)}
                      className={`flex items-center justify-between w-full p-3 rounded-xl border transition-all text-left uppercase text-xs font-semibold ${
                        isSelected
                          ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                          : 'bg-zinc-900/40 border-zinc-850 text-zinc-400'
                      }`}
                    >
                      <span>{src}</span>
                      {isSelected && <CheckCircle size={14} className="text-accent-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sorting select block */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-zinc-500 font-mono tracking-wider uppercase">Sort Order</h4>
              <select
                value={activeSort}
                onChange={(e) => handleSortChange(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-800 text-zinc-200 text-xs font-bold uppercase rounded-xl p-3 outline-none"
              >
                <option value="deadline_asc">DEADLINE (SOONEST)</option>
                <option value="deadline_desc">DEADLINE (LATEST)</option>
                <option value="newest">NEWEST ADDED</option>
              </select>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-3 border-t border-zinc-800 pt-5">
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    handleReset();
                    setIsDrawerOpen(false);
                  }}
                  className="flex-1 py-3 text-xs font-bold text-center border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl"
                >
                  Reset All
                </button>
              )}
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 py-3 text-xs font-bold text-center text-white bg-accent-primary rounded-xl"
              >
                Apply Filters
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
