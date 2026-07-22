'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import RosterCard from '@/components/RosterCard';
import ControlDock from '@/components/ControlDock';
import { exportRosterPNG } from '@/components/PosterExporter';
import { RostersMap, AuthRole, RosterColumnKey } from '@/lib/types';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import { sha256 } from '@/lib/auth';

const HASHES = { master: "9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a" };

export default function CleaningPage() {
  const [rosters, setRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [savedRosters, setSavedRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [authRole, setAuthRole] = useState<AuthRole>('none');
  const [authPassword, setAuthPassword] = useState<string>('');
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

  const handleLogin = async (password: string) => {
    const hash = await sha256(password);
    if (hash === HASHES.master) {
      setAuthRole('master'); setAuthPassword(password);
      document.body.classList.add('editing-active');
      return true;
    }
    return false;
  };

  const handleCellChange = (_: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => {
    setRosters(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as RostersMap;
      updated.cleaning_roster.rows[rowIndex][colKey] = newValue;
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
  rosters.cleaning_roster.rows.forEach((r, idx) => {
    Object.keys(r).forEach(col => {
      if (col !== 'day' && r[col] !== savedRosters.cleaning_roster.rows[idx]?.[col]) unsavedCount++;
    });
  });

  return (
    <div className="min-h-screen flex flex-col pb-24">
      <Navbar authRole={authRole} onLogin={handleLogin} onLogout={() => { setAuthRole('none'); document.body.classList.remove('editing-active'); }} isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        <RosterCard roster={rosters.cleaning_roster} hasEditAccess={authRole === 'master'} onCellChange={handleCellChange} savedRows={savedRosters.cleaning_roster.rows} />
      </main>
      <ControlDock hasEditAccess={authRole === 'master'} unsavedCount={unsavedCount} onSave={handleSave} onCancel={() => setRosters(JSON.parse(JSON.stringify(savedRosters)))} onReset={() => {}} onDownload={() => exportRosterPNG(rosters.cleaning_roster, isDark)} isSaving={isSaving} />
    </div>
  );
}
