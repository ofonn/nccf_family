'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  Participant,
  RostersMap,
  RosterColumnKey,
  RostersPayload,
  WeeklyAllocationMetadata,
  WeeklySnapshot,
} from '@/lib/types';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import { useAuth } from '@/lib/authContext';
import { useParticipants } from '@/lib/participantsContext';
import {
  deserializeFairRosterWeights,
  getSlotEligibility,
  reconcileFairRosterMetadata,
  type FairRosterBalance,
  type FairRosterMetadata,
  type FairRosterMode,
  type FairRosterWeights,
  type SlotEligibility,
} from '@/lib/fairRoster';
import { selectPriorFairRosterBalances } from '@/lib/fairRosterHistory';
import { getCurrentSundayISO } from '@/lib/rosterCalendar';

interface RosterSaveResult {
  success: boolean;
  error?: string;
}

interface GeneratedDraft {
  allocation: WeeklyAllocationMetadata;
  weekStart: string;
  members: Participant[];
}

interface RostersContextType {
  rosters: RostersMap;
  savedRosters: RostersMap;
  isLoading: boolean;
  isSaving: boolean;
  unsavedCount: number;
  activeWeekStart?: string;
  activeAllocation: WeeklyAllocationMetadata | null;
  snapshots: WeeklySnapshot[];
  handleCellChange: (
    rosterId: string,
    rowIndex: number,
    colKey: RosterColumnKey,
    newValue: string,
  ) => void;
  applyGeneratedDraft: (
    rosters: RostersMap,
    allocation: WeeklyAllocationMetadata,
    weekStart: string,
    members: Participant[],
  ) => void;
  getPriorBalancesForWeek: (
    weekStart: string,
    mode?: FairRosterMode,
  ) => Record<string, FairRosterBalance>;
  getSlotEligibility: (rosterId: string, rowIndex: number) => SlotEligibility[] | null;
  saveChanges: () => Promise<RosterSaveResult>;
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
  activeAllocation: null,
  snapshots: [],
  handleCellChange: () => {},
  applyGeneratedDraft: () => {},
  getPriorBalancesForWeek: () => ({}),
  getSlotEligibility: () => null,
  saveChanges: async () => ({ success: false }),
  cancelEdits: () => {},
  resetDefaults: async () => false,
  refreshRosters: async () => {},
});

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function readResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const message = (body as Record<string, unknown>).error;
      if (typeof message === 'string') return message;
    }
  } catch {
    // Use the caller's safe fallback.
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readBalanceRecord(value: unknown): Record<string, FairRosterBalance> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, FairRosterBalance> = {};
  for (const [memberId, candidate] of Object.entries(value)) {
    if (!isRecord(candidate)) return undefined;
    const { workload, cooking, cleaning } = candidate;
    if (
      typeof workload !== 'number'
      || !Number.isFinite(workload)
      || typeof cooking !== 'number'
      || !Number.isFinite(cooking)
      || typeof cleaning !== 'number'
      || !Number.isFinite(cleaning)
    ) return undefined;
    result[memberId] = { workload, cooking, cleaning };
  }
  return result;
}

function readWeights(metadata: WeeklyAllocationMetadata): FairRosterWeights | undefined {
  const configured = metadata.weightConfiguration;
  if (
    isRecord(configured)
    && isRecord(configured.eventWeights)
    && typeof configured.defaultPrayerEvent === 'number'
    && typeof configured.cleaning === 'number'
    && typeof configured.cookingSundaySolo === 'number'
    && typeof configured.cookingPairedRegular === 'number'
    && typeof configured.cookingPairedFasting === 'number'
  ) {
    return configured as unknown as FairRosterWeights;
  }

  if (isRecord(metadata.weights)) {
    const entries = Object.entries(metadata.weights);
    if (entries.every(([, value]) => typeof value === 'number')) {
      return deserializeFairRosterWeights(metadata.weights as Record<string, number>);
    }
  }
  return undefined;
}

function readMode(metadata: WeeklyAllocationMetadata): FairRosterMode {
  return metadata.mode === 'appearances' ? 'appearances' : 'weighted';
}

function memberNameFromMetadata(
  metadata: WeeklyAllocationMetadata,
  memberId: string,
): string | undefined {
  if (isRecord(metadata.memberLoads)) {
    const load = metadata.memberLoads[memberId];
    if (isRecord(load) && typeof load.name === 'string' && load.name.trim()) {
      return load.name.trim();
    }
  }

  if (Array.isArray(metadata.assignments)) {
    for (const assignment of metadata.assignments) {
      if (!isRecord(assignment) || !Array.isArray(assignment.memberIds)) continue;
      const memberIndex = assignment.memberIds.indexOf(memberId);
      if (memberIndex < 0 || !Array.isArray(assignment.memberNames)) continue;
      const name = assignment.memberNames[memberIndex];
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
  }
  return undefined;
}

function membersForMetadata(
  metadata: WeeklyAllocationMetadata,
  currentParticipants: Participant[],
): Participant[] {
  const ids = Array.isArray(metadata.availableMemberIds)
    ? metadata.availableMemberIds.filter((id): id is string => typeof id === 'string')
    : [];
  const currentById = new Map(currentParticipants.map((participant) => [participant.id, participant]));

  return ids.flatMap((id) => {
    const current = currentById.get(id);
    if (current) return [current];
    const archivedName = memberNameFromMetadata(metadata, id);
    return archivedName ? [{ id, name: archivedName }] : [];
  });
}

export function RostersProvider({ children }: { children: React.ReactNode }) {
  const { authRole, authPassword } = useAuth();
  const { participants } = useParticipants();
  const [rosters, setRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [savedRosters, setSavedRosters] = useState<RostersMap>(DEFAULT_ROSTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetched, setIsFetched] = useState(false);
  const [activeWeekStart, setActiveWeekStart] = useState<string | undefined>();
  const [activeAllocation, setActiveAllocation] = useState<WeeklyAllocationMetadata | null>(null);
  const [snapshots, setSnapshots] = useState<WeeklySnapshot[]>([]);
  const [generatedDraft, setGeneratedDraft] = useState<GeneratedDraft | null>(null);

  const refreshRosters = useCallback(async () => {
    try {
      const response = await fetch('/api/rosters', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, 'Unable to load the roster board.'));
      }
      const data = await response.json() as RostersPayload;
      if (data.rosters) {
        setRosters(clone(data.rosters));
        setSavedRosters(clone(data.rosters));
        setActiveWeekStart(data.activeWeekStart);
        setActiveAllocation(data.activeAllocation || null);
        setSnapshots(data.snapshots || []);
        setGeneratedDraft(null);
      }
    } catch (error) {
      console.error('Failed to load rosters API:', error);
    } finally {
      setIsLoading(false);
      setIsFetched(true);
    }
  }, []);

  useEffect(() => {
    if (isFetched) return;
    const timeoutId = window.setTimeout(() => {
      void refreshRosters();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isFetched, refreshRosters]);

  const handleCellChange = (
    rosterId: string,
    rowIndex: number,
    colKey: RosterColumnKey,
    newValue: string,
  ) => {
    if (authRole === 'none') return;
    setRosters((current) => {
      const updated = clone(current);
      const key = rosterId as keyof RostersMap;
      if (updated[key]?.rows[rowIndex]) updated[key].rows[rowIndex][colKey] = newValue;
      return updated;
    });
  };

  const applyGeneratedDraft = (
    generatedRosters: RostersMap,
    allocation: WeeklyAllocationMetadata,
    weekStart: string,
    members: Participant[],
  ) => {
    if (authRole !== 'master') return;
    setRosters(clone(generatedRosters));
    setGeneratedDraft({
      allocation: clone(allocation),
      weekStart,
      members: clone(members),
    });
  };

  const getPriorBalancesForWeek = useCallback((
    weekStart: string,
    mode: FairRosterMode = 'weighted',
  ) => (
    selectPriorFairRosterBalances({
      targetWeekStart: weekStart,
      mode,
      activeWeekStart,
      activeAllocation,
      snapshots,
    })
  ), [activeAllocation, activeWeekStart, snapshots]);

  const cancelEdits = () => {
    setRosters(clone(savedRosters));
    setGeneratedDraft(null);
  };

  const getSlotEligibilityForCell = useCallback((
    rosterId: string,
    rowIndex: number,
  ): SlotEligibility[] | null => {
    // Eligibility only applies to allocator-managed rosters; Glorious
    // Service is never auto-assigned, so it keeps its plain member list.
    if (
      rosterId !== 'prayer_roster'
      && rosterId !== 'cleaning_roster'
      && rosterId !== 'cooking_roster'
    ) return null;

    // Prefer the in-progress draft (what the user is reviewing right now),
    // falling back to the last published allocation.
    const source = generatedDraft
      ? {
        members: generatedDraft.members,
        weekStart: generatedDraft.weekStart,
        allocation: generatedDraft.allocation,
      }
      : activeAllocation
        ? {
          members: membersForMetadata(activeAllocation, participants),
          weekStart: activeWeekStart || getCurrentSundayISO(),
          allocation: activeAllocation,
        }
        : null;
    if (!source || source.members.length === 0) return null;

    try {
      return getSlotEligibility({
        rosters,
        members: source.members,
        weekStart: source.weekStart,
        mode: readMode(source.allocation),
        weights: readWeights(source.allocation),
        rosterId,
        rowIndex,
      });
    } catch {
      return null;
    }
  }, [activeAllocation, activeWeekStart, generatedDraft, participants, rosters]);

  const reconcileAllocation = (): FairRosterMetadata | null => {
    if (authRole === 'none') return null;

    if (generatedDraft) {
      if (authRole !== 'master') return null;
      const metadata = generatedDraft.allocation;
      return reconcileFairRosterMetadata({
        rosters,
        members: generatedDraft.members,
        weekStart: generatedDraft.weekStart,
        mode: readMode(metadata),
        balancesBefore: readBalanceRecord(
          metadata.balancesBefore || metadata.previousBalances,
        ),
        seed: typeof metadata.seed === 'string' ? metadata.seed : undefined,
        generatedAt: metadata.generatedAt,
        weights: readWeights(metadata),
      }).metadata;
    }

    if (!activeAllocation) return null;
    const members = membersForMetadata(activeAllocation, participants);
    const ids = Array.isArray(activeAllocation.availableMemberIds)
      ? activeAllocation.availableMemberIds.filter((id): id is string => typeof id === 'string')
      : [];
    if (ids.length === 0 || members.length !== ids.length) {
      throw new Error('This older roster has incomplete fairness data. Generate a fresh fair roster before publishing edits.');
    }

    return reconcileFairRosterMetadata({
      rosters,
      members,
      weekStart: activeWeekStart || getCurrentSundayISO(),
      mode: readMode(activeAllocation),
      balancesBefore: readBalanceRecord(
        activeAllocation.balancesBefore || activeAllocation.previousBalances,
      ),
      seed: typeof activeAllocation.seed === 'string' ? activeAllocation.seed : undefined,
      generatedAt: activeAllocation.generatedAt,
      weights: readWeights(activeAllocation),
    }).metadata;
  };

  const saveChanges = async (): Promise<RosterSaveResult> => {
    if (!authPassword || authRole === 'none') {
      return { success: false, error: 'Sign in as an administrator before publishing.' };
    }
    setIsSaving(true);
    try {
      const allocation = reconcileAllocation();
      const weekStart = generatedDraft?.weekStart
        || activeWeekStart
        || getCurrentSundayISO();
      const response = await fetch('/api/rosters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authPassword,
        },
        body: JSON.stringify({ rosters, weekStart, allocation }),
      });
      if (!response.ok) {
        return {
          success: false,
          error: await readResponseError(response, 'Unable to publish roster changes.'),
        };
      }

      const data = await response.json() as RostersPayload & { snapshot?: WeeklySnapshot };
      const publishedRosters = data.rosters || rosters;
      setRosters(clone(publishedRosters));
      setSavedRosters(clone(publishedRosters));
      setActiveWeekStart(data.activeWeekStart || weekStart);
      setActiveAllocation(data.activeAllocation || allocation);
      if (data.snapshot) {
        setSnapshots((current) => [
          ...current.filter((snapshot) => snapshot.weekId !== data.snapshot?.weekId),
          data.snapshot as WeeklySnapshot,
        ]);
      }
      setGeneratedDraft(null);
      return { success: true };
    } catch (error) {
      console.error('Save failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to publish roster changes.',
      };
    } finally {
      setIsSaving(false);
    }
  };

  const resetDefaults = async (): Promise<boolean> => {
    if (authRole !== 'master' || !authPassword) return false;
    try {
      const response = await fetch('/api/rosters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authPassword,
          'x-action': 'reset',
        },
      });
      if (!response.ok) return false;
      const data = await response.json() as RostersPayload;
      const resetRosters = data.rosters || DEFAULT_ROSTERS;
      setRosters(clone(resetRosters));
      setSavedRosters(clone(resetRosters));
      setActiveWeekStart(data.activeWeekStart);
      setActiveAllocation(data.activeAllocation || null);
      setGeneratedDraft(null);
      return true;
    } catch (error) {
      console.error('Reset failed:', error);
      return false;
    }
  };

  let unsavedCount = 0;
  if (authRole !== 'none') {
    (Object.keys(rosters) as Array<keyof RostersMap>).forEach((rosterId) => {
      rosters[rosterId].rows.forEach((row, rowIndex) => {
        Object.keys(row).forEach((column) => {
          if (column !== 'day' && row[column] !== savedRosters[rosterId]?.rows[rowIndex]?.[column]) {
            unsavedCount += 1;
          }
        });
      });
    });
    if (generatedDraft) unsavedCount += 1;
  }

  return (
    <RostersContext.Provider value={{
      rosters,
      savedRosters,
      isLoading,
      isSaving,
      unsavedCount,
      activeWeekStart,
      activeAllocation,
      snapshots,
      handleCellChange,
      applyGeneratedDraft,
      getPriorBalancesForWeek,
      getSlotEligibility: getSlotEligibilityForCell,
      saveChanges,
      cancelEdits,
      resetDefaults,
      refreshRosters,
    }}>
      {children}
    </RostersContext.Provider>
  );
}

export function useRosters() {
  return useContext(RostersContext);
}
