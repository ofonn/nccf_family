'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import RosterCard from '@/components/RosterCard';
import ClashCheckerAlert from '@/components/ClashCheckerAlert';
import ControlDock from '@/components/ControlDock';
import { exportRosterPNG, exportAllRostersPNG } from '@/components/PosterExporter';
import { RostersMap } from '@/lib/types';
import { performClashCheck } from '@/lib/clashChecker';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';
import { useRosters } from '@/lib/rostersContext';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { authRole } = useAuth();
  const { isDark } = useTheme();
  const { rosters, savedRosters, isLoading, handleCellChange } = useRosters();

  const clashes = performClashCheck(rosters);

  const rosterEntries: { key: keyof RostersMap; editCheck: boolean }[] = [
    { key: 'prayer_roster', editCheck: authRole === 'master' || authRole === 'prayer_coordinator' },
    { key: 'glorious_service', editCheck: authRole === 'master' || authRole === 'prayer_coordinator' },
    { key: 'cleaning_roster', editCheck: authRole === 'master' },
    { key: 'cooking_roster', editCheck: authRole === 'master' || authRole === 'prayer_coordinator' },
  ];

  return (
    <div className="min-h-screen flex flex-col pb-28">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 py-5 space-y-5">
        {/* Banner Section */}
        <div className="text-center space-y-1.5 py-2 sm:py-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[var(--nysc-green)] tracking-tight leading-tight">
            NCCF Family House Schedules
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] max-w-md mx-auto font-semibold">
            Tap any cell to select options or double-tap to type custom entries.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--nysc-green)]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
              Loading Roster Board...
            </p>
          </div>
        ) : (
          <>
            {/* Live Clash Warnings */}
            <ClashCheckerAlert clashes={clashes} />

            {/* Modular Table Cards */}
            <div className="space-y-5">
              {rosterEntries.map(({ key, editCheck }) => (
                <RosterCard
                  key={key}
                  roster={rosters[key]}
                  hasEditAccess={editCheck}
                  onCellChange={handleCellChange}
                  savedRows={savedRosters[key].rows}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <ControlDock
        hasEditAccess={authRole !== 'none'}
        onDownload={() => exportRosterPNG(rosters.prayer_roster, isDark)}
        onDownloadAll={() => exportAllRostersPNG(rosters, isDark)}
      />
    </div>
  );
}
