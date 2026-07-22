'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import RosterCard from '@/components/RosterCard';
import ControlDock from '@/components/ControlDock';
import { exportRosterPNG } from '@/components/PosterExporter';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';
import { useRosters } from '@/lib/rostersContext';

export default function ServicePage() {
  const { authRole } = useAuth();
  const { isDark } = useTheme();
  const { rosters, savedRosters, handleCellChange } = useRosters();

  const hasEdit = authRole === 'master' || authRole === 'prayer_coordinator';

  return (
    <div className="min-h-screen flex flex-col pb-28">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 py-5 space-y-5">
        <RosterCard
          roster={rosters.glorious_service}
          hasEditAccess={hasEdit}
          onCellChange={handleCellChange}
          savedRows={savedRosters.glorious_service.rows}
        />
      </main>
      <ControlDock
        hasEditAccess={hasEdit}
        onDownload={() => exportRosterPNG(rosters.glorious_service, isDark)}
      />
    </div>
  );
}
