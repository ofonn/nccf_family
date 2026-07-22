'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { RostersMap, RosterColumnKey } from '@/lib/types';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import { useAuth } from '@/lib/authContext';

interface RostersContextType {
  rosters: RostersMap;
  savedRosters: RostersMap;
  isLoading: boolean;
  isSaving: boolean;
  unsavedCount: number;
  handleCellChange: (rosterId: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => void;
  saveChanges: () => Promise<boolean>;
  cancelEdits: () => void;
  resetDefaults: () => Promise<boolean>;
  refreshRosters: () => Promise<void>;
}

const RostersContext = createContext<RostersContextType>({
  rosters: DEFAULT_ROSTERS,
  savedRosters: DEFAULT_ROSTERS,
  isLoading: true,
  isSaving: false,
  unsavedCount: 0,
  handleCellChange: () => {},
  saveChanges: async () => false,
  cancelEdits: () => {},
  resetDefaults: async () => false,
  refreshRosters: async () => {},
});

export function RostersProvider({ children }: { children: React.ReactNode }) {
  const { authRole, authPassword } = useAuth();

  const [rosters, setRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [savedRosters, setSavedRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetched, setIsFetched] = useState(false);

  // Fetch rosters ONCE globally and deduplicate across pages
  const refreshRosters = useCallback(async () => {
    try {
      const res = await fetch('/api/rosters', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (data?.rosters) {
        setRosters(data.rosters);
        setSavedRosters(data.rosters);
      }
    } catch (err) {
      console.error("Failed to load rosters API:", err);
    } finally {
      setIsLoading(false);
      setIsFetched(true);
    }
  }, []);

  useEffect(() => {
    if (!isFetched) {
      refreshRosters();
    }
  }, [isFetched, refreshRosters]);

  const handleCellChange = (rosterId: string, rowIndex: number, colKey: RosterColumnKey, newValue: string) => {
    // STRICT GUARD: If user has no edit permissions, do nothing
    if (authRole === 'none') return;

    setRosters((prev) => {
      const updated = JSON.parse(JSON.stringify(prev)) as RostersMap;
      const key = rosterId as keyof RostersMap;
      if (updated[key]?.rows[rowIndex]) {
        updated[key].rows[rowIndex][colKey] = newValue;
      }
      return updated;
    });
  };

  const cancelEdits = () => {
    setRosters(JSON.parse(JSON.stringify(savedRosters)));
  };

  const saveChanges = async (): Promise<boolean> => {
    if (!authPassword || authRole === 'none') return false;
    setIsSaving(true);
    try {
      const res = await fetch('/api/rosters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authPassword,
        },
        body: JSON.stringify(rosters),
      });
      if (res.ok) {
        setSavedRosters(JSON.parse(JSON.stringify(rosters)));
        return true;
      }
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setIsSaving(false);
    }
    return false;
  };

  const resetDefaults = async (): Promise<boolean> => {
    if (authRole !== 'master' || !authPassword) return false;
    try {
      const res = await fetch('/api/rosters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authPassword,
          'x-action': 'reset',
        },
      });
      if (res.ok) {
        setRosters(DEFAULT_ROSTERS);
        setSavedRosters(DEFAULT_ROSTERS);
        return true;
      }
    } catch (e) {
      console.error("Reset failed:", e);
    }
    return false;
  };

  // Calculate unsaved edits count ONLY IF user has edit role!
  let unsavedCount = 0;
  if (authRole !== 'none') {
    (Object.keys(rosters) as (keyof RostersMap)[]).forEach((rId) => {
      rosters[rId].rows.forEach((r, idx) => {
        Object.keys(r).forEach((col) => {
          if (col !== 'day' && r[col] !== savedRosters[rId]?.rows[idx]?.[col]) {
            unsavedCount++;
          }
        });
      });
    });
  }

  return (
    <RostersContext.Provider
      value={{
        rosters,
        savedRosters,
        isLoading,
        isSaving,
        unsavedCount,
        handleCellChange,
        saveChanges,
        cancelEdits,
        resetDefaults,
        refreshRosters,
      }}
    >
      {children}
    </RostersContext.Provider>
  );
}

export function useRosters() {
  return useContext(RostersContext);
}
