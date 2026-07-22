'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import RosterCard from '@/components/RosterCard';
import ClashCheckerAlert from '@/components/ClashCheckerAlert';
import ControlDock from '@/components/ControlDock';
import { exportRosterPNG, exportAllRostersPNG } from '@/components/PosterExporter';
import { RostersMap, RosterColumnKey } from '@/lib/types';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import { performClashCheck } from '@/lib/clashChecker';
import { useAuth } from '@/lib/authContext';

export default function HomePage() {
  const { authRole, authPassword } = useAuth();

  const [rosters, setRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [savedRosters, setSavedRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [isDark, setIsDark] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/rosters')
      .then(res => res.json())
      .then(data => {
        if (data?.rosters) {
          setRosters(data.rosters);
          setSavedRosters(data.rosters);
        }
      })
      .catch(err => console.error("API load error:", err));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const handleCellChange = (rosterId: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => {
    setRosters(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as RostersMap;
      const key = rosterId as keyof RostersMap;
      if (updated[key]?.rows[rowIndex]) {
        updated[key].rows[rowIndex][colKey] = newValue;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!authPassword) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/rosters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': authPassword },
        body: JSON.stringify(rosters),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedRosters(JSON.parse(JSON.stringify(rosters)));
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (e) {
      console.error(e);
      alert('Save request failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => setRosters(JSON.parse(JSON.stringify(savedRosters)));

  const handleReset = async () => {
    if (authRole !== 'master') return alert('Only Master Admin can reset.');
    try {
      const res = await fetch('/api/rosters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': authPassword, 'x-action': 'reset' },
      });
      if (res.ok) {
        setRosters(DEFAULT_ROSTERS);
        setSavedRosters(DEFAULT_ROSTERS);
      }
    } catch (e) { console.error(e); }
  };

  // Count unsaved changes
  let unsavedCount = 0;
  (Object.keys(rosters) as (keyof RostersMap)[]).forEach(rId => {
    rosters[rId].rows.forEach((r, idx) => {
      Object.keys(r).forEach(col => {
        if (col !== 'day' && r[col] !== savedRosters[rId]?.rows[idx]?.[col]) unsavedCount++;
      });
    });
  });

  const clashes = performClashCheck(rosters);

  const rosterEntries: { key: keyof RostersMap; editCheck: boolean }[] = [
    { key: 'prayer_roster', editCheck: authRole === 'master' || authRole === 'prayer_coordinator' },
    { key: 'glorious_service', editCheck: authRole === 'master' || authRole === 'prayer_coordinator' },
    { key: 'cleaning_roster', editCheck: authRole === 'master' },
    { key: 'cooking_roster', editCheck: authRole === 'master' || authRole === 'prayer_coordinator' },
  ];

  return (
    <div className="min-h-screen flex flex-col pb-28">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 py-5 space-y-5">
        {/* Banner Section */}
        <div className="text-center space-y-2 py-2 sm:py-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--nysc-gold-light)] text-[var(--nysc-gold)] border border-[var(--nysc-gold)]/30 text-[11px] font-extrabold">
            🇳🇬 NYSC Corps Members Fellowship
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[var(--nysc-green)] tracking-tight leading-tight">
            NCCF Family House Schedules
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] max-w-md mx-auto font-semibold">
            Tap any cell to select from predefined options or double-tap to type custom entries.
          </p>
        </div>

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
      </main>

      <ControlDock
        hasEditAccess={authRole !== 'none'}
        unsavedCount={unsavedCount}
        onSave={handleSave}
        onCancel={handleCancel}
        onReset={handleReset}
        onDownload={() => exportRosterPNG(rosters.prayer_roster, isDark)}
        onDownloadAll={() => exportAllRostersPNG(rosters, isDark)}
        isSaving={isSaving}
      />
    </div>
  );
}
