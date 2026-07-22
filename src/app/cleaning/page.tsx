'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import RosterCard from '@/components/RosterCard';
import ControlDock from '@/components/ControlDock';
import { exportRosterPNG } from '@/components/PosterExporter';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';
import { useRosters } from '@/lib/rostersContext';

export default function CleaningPage() {
  const { authRole } = useAuth();
  const { isDark } = useTheme();
  const { rosters, savedRosters, handleCellChange } = useRosters();

  const hasEdit = authRole === 'master';

  return (
    <div className="min-h-screen flex flex-col pb-28">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 py-5 space-y-5">
        <RosterCard
          roster={rosters.cleaning_roster}
          hasEditAccess={hasEdit}
          onCellChange={handleCellChange}
          savedRows={savedRosters.cleaning_roster.rows}
        />
      </main>
      <ControlDock
        hasEditAccess={hasEdit}
        onDownload={() => exportRosterPNG(rosters.cleaning_roster, isDark)}
      />
    </div>
  );
}
