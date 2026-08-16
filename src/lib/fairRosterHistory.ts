import { normalizeToSundayISO } from './rosterCalendar';
import type { FairRosterBalance } from './fairRoster';
import type { WeeklyAllocationMetadata, WeeklySnapshot } from './types';

interface FairRosterHistoryState {
  targetWeekStart: string;
  activeWeekStart?: string;
  activeAllocation?: WeeklyAllocationMetadata | null;
  snapshots?: WeeklySnapshot[];
}

function readBalances(
  metadata: WeeklyAllocationMetadata | null | undefined,
  keys: Array<'balancesBefore' | 'previousBalances' | 'balancesAfter' | 'nextBalances'>,
): Record<string, FairRosterBalance> | null {
  if (!metadata) return null;

  for (const key of keys) {
    const candidate = metadata[key];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;

    const parsed: Record<string, FairRosterBalance> = {};
    let valid = true;
    for (const [memberId, value] of Object.entries(candidate)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        valid = false;
        break;
      }
      const balance = value as unknown as Record<string, unknown>;
      if (
        typeof balance.workload !== 'number'
        || !Number.isFinite(balance.workload)
        || typeof balance.cooking !== 'number'
        || !Number.isFinite(balance.cooking)
        || typeof balance.cleaning !== 'number'
        || !Number.isFinite(balance.cleaning)
      ) {
        valid = false;
        break;
      }
      parsed[memberId] = {
        workload: balance.workload,
        cooking: balance.cooking,
        cleaning: balance.cleaning,
      };
    }
    if (valid) return parsed;
  }

  return null;
}

function cloneBalances(
  balances: Record<string, FairRosterBalance> | null,
): Record<string, FairRosterBalance> {
  if (!balances) return {};
  return Object.fromEntries(
    Object.entries(balances).map(([memberId, balance]) => [memberId, { ...balance }]),
  );
}

/**
 * Finds the balance ledger that belongs immediately before a target week.
 * Regenerating an existing week deliberately uses its balances-before ledger,
 * while a later week starts from the closest earlier balances-after ledger.
 */
export function selectPriorFairRosterBalances({
  targetWeekStart,
  activeWeekStart,
  activeAllocation,
  snapshots = [],
}: FairRosterHistoryState): Record<string, FairRosterBalance> {
  const target = normalizeToSundayISO(targetWeekStart);
  const normalizedActiveWeek = activeWeekStart
    ? normalizeToSundayISO(activeWeekStart)
    : undefined;

  if (normalizedActiveWeek === target) {
    const exactActive = readBalances(activeAllocation, ['balancesBefore', 'previousBalances']);
    if (exactActive) return cloneBalances(exactActive);
  }

  const normalizedSnapshots = snapshots.flatMap((snapshot) => {
    const weekValue = snapshot.weekStart || snapshot.weekId;
    try {
      return [{ ...snapshot, normalizedWeek: normalizeToSundayISO(weekValue) }];
    } catch {
      return [];
    }
  });

  const exactSnapshot = normalizedSnapshots.find(
    (snapshot) => snapshot.normalizedWeek === target,
  );
  if (exactSnapshot) {
    const exact = readBalances(exactSnapshot.allocation, ['balancesBefore', 'previousBalances']);
    if (exact) return cloneBalances(exact);
  }

  const priorCandidates: Array<{
    weekStart: string;
    allocation: WeeklyAllocationMetadata;
  }> = normalizedSnapshots
    .filter((snapshot) => snapshot.normalizedWeek < target && snapshot.allocation)
    .map((snapshot) => ({
      weekStart: snapshot.normalizedWeek,
      allocation: snapshot.allocation as WeeklyAllocationMetadata,
    }));

  if (normalizedActiveWeek && normalizedActiveWeek < target && activeAllocation) {
    priorCandidates.push({ weekStart: normalizedActiveWeek, allocation: activeAllocation });
  }

  priorCandidates.sort((left, right) => right.weekStart.localeCompare(left.weekStart));
  for (const candidate of priorCandidates) {
    const balances = readBalances(candidate.allocation, ['balancesAfter', 'nextBalances']);
    if (balances) return cloneBalances(balances);
  }

  return {};
}
