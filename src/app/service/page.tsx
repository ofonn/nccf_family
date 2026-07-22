'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import RosterCard from '@/components/RosterCard';
import ControlDock from '@/components/ControlDock';
import { exportRosterPNG } from '@/components/PosterExporter';
import { RostersMap, RosterColumnKey } from '@/lib/types';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import { useAuth } from '@/lib/authContext';

export default function ServicePage() {
  const { authRole, authPassword } = useAuth();

  const [rosters, setRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [savedRosters, setSavedRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [isDark, setIsDark] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/rosters').then(r => r.json()).then(d => {
      if (d?.rosters) { setRosters(d.rosters); setSavedRosters(d.rosters); }
    }).catch(console.error);
  }, []);

  useEffect(() => { document.documentElement.classList.toggle('dark', isDark); }, [isDark]);

  const handleCellChange = (_: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => {
    setRosters(prev => {
      const u = JSON.parse(JSON.stringify(prev)) as RostersMap;
      u.glorious_service.rows[rowIndex][colKey] = newValue;
      return u;
    });
  };

  const handleSave = async () => {
    if (!authPassword) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/rosters', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-password': authPassword }, body: JSON.stringify(rosters) });
      if (res.ok) setSavedRosters(JSON.parse(JSON.stringify(rosters)));
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  let unsavedCount = 0;
  rosters.glorious_service.rows.forEach((r, idx) => {
    Object.keys(r).forEach(col => { if (col !== 'day' && r[col] !== savedRosters.glorious_service.rows[idx]?.[col]) unsavedCount++; });
  });

  const hasEdit = authRole === 'master' || authRole === 'prayer_coordinator';

  return (
    <div className="min-h-screen flex flex-col pb-28">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 py-5 space-y-5">
        <RosterCard roster={rosters.glorious_service} hasEditAccess={hasEdit} onCellChange={handleCellChange} savedRows={savedRosters.glorious_service.rows} />
      </main>
      <ControlDock hasEditAccess={hasEdit} unsavedCount={unsavedCount} onSave={handleSave} onCancel={() => setRosters(JSON.parse(JSON.stringify(savedRosters)))} onReset={() => {}} onDownload={() => exportRosterPNG(rosters.glorious_service, isDark)} isSaving={isSaving} />
    </div>
  );
}
