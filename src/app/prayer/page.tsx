'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import RosterCard from '@/components/RosterCard';
import ControlDock from '@/components/ControlDock';
import { exportRosterPNG } from '@/components/PosterExporter';
import { RostersMap, AuthRole, RosterColumnKey } from '@/lib/types';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import { sha256, AUTH_HASHES } from '@/lib/auth';

export default function PrayerPage() {
  const [rosters, setRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [savedRosters, setSavedRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [authRole, setAuthRole] = useState<AuthRole>('none');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [isDark, setIsDark] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/rosters').then(r => r.json()).then(d => {
      if (d?.rosters) { setRosters(d.rosters); setSavedRosters(d.rosters); }
    }).catch(console.error);
  }, []);

  useEffect(() => { document.documentElement.classList.toggle('dark', isDark); }, [isDark]);

  const handleLogin = async (password: string) => {
    const hash = await sha256(password);
    if (hash === AUTH_HASHES.master) { setAuthRole('master'); setAuthPassword(password); document.body.classList.add('editing-active'); return true; }
    if (hash === AUTH_HASHES.prayer_coordinator) { setAuthRole('prayer_coordinator'); setAuthPassword(password); document.body.classList.add('editing-active'); return true; }
    return false;
  };

  const handleCellChange = (_: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => {
    setRosters(prev => {
      const u = JSON.parse(JSON.stringify(prev)) as RostersMap;
      u.prayer_roster.rows[rowIndex][colKey] = newValue;
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
  rosters.prayer_roster.rows.forEach((r, idx) => {
    Object.keys(r).forEach(col => { if (col !== 'day' && r[col] !== savedRosters.prayer_roster.rows[idx]?.[col]) unsavedCount++; });
  });

  return (
    <div className="min-h-screen flex flex-col pb-28">
      <Navbar authRole={authRole} onLogin={handleLogin} onLogout={() => { setAuthRole('none'); document.body.classList.remove('editing-active'); }} isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 py-5 space-y-5">
        <RosterCard roster={rosters.prayer_roster} hasEditAccess={authRole === 'master' || authRole === 'prayer_coordinator'} onCellChange={handleCellChange} savedRows={savedRosters.prayer_roster.rows} />
      </main>
      <ControlDock hasEditAccess={authRole !== 'none'} unsavedCount={unsavedCount} onSave={handleSave} onCancel={() => setRosters(JSON.parse(JSON.stringify(savedRosters)))} onReset={() => {}} onDownload={() => exportRosterPNG(rosters.prayer_roster, isDark)} isSaving={isSaving} />
    </div>
  );
}
