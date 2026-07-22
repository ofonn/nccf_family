'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import RosterCard from '@/components/RosterCard';
import ControlDock from '@/components/ControlDock';
import { exportRosterPNG } from '@/components/PosterExporter';
import { RostersMap, RosterColumnKey } from '@/lib/types';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import { useAuth } from '@/lib/authContext';

export default function CookingPage() {
  const { authRole, authPassword } = useAuth();

  const [rosters, setRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [savedRosters, setSavedRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [isDark, setIsDark] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/rosters')
      .then(res => res.json())
      .then(data => {
        if (data?.rosters) { setRosters(data.rosters); setSavedRosters(data.rosters); }
      }).catch(console.error);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const handleCellChange = (_: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => {
    setRosters(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as RostersMap;
      updated.cooking_roster.rows[rowIndex][colKey] = newValue;
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
      if (res.ok) setSavedRosters(JSON.parse(JSON.stringify(rosters)));
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  let unsavedCount = 0;
  rosters.cooking_roster.rows.forEach((r, idx) => {
    Object.keys(r).forEach(col => {
      if (col !== 'day' && r[col] !== savedRosters.cooking_roster.rows[idx]?.[col]) unsavedCount++;
    });
  });

  const hasEdit = authRole === 'master';

  return (
    <div className="min-h-screen flex flex-col pb-28">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 py-5 space-y-5">
        <RosterCard roster={rosters.cooking_roster} hasEditAccess={hasEdit} onCellChange={handleCellChange} savedRows={savedRosters.cooking_roster.rows} />
      </main>
      <ControlDock hasEditAccess={hasEdit} unsavedCount={unsavedCount} onSave={handleSave} onCancel={() => setRosters(JSON.parse(JSON.stringify(savedRosters)))} onReset={() => {}} onDownload={() => exportRosterPNG(rosters.cooking_roster, isDark)} isSaving={isSaving} />
    </div>
  );
}
