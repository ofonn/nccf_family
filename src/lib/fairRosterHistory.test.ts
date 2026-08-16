import { describe, expect, it } from 'vitest';
import { DEFAULT_ROSTERS } from './constants';
import { selectPriorFairRosterBalances } from './fairRosterHistory';
import type { WeeklyAllocationMetadata, WeeklySnapshot } from './types';

function allocation(
  before: Record<string, { workload: number; cooking: number; cleaning: number }>,
  after: Record<string, { workload: number; cooking: number; cleaning: number }>,
): WeeklyAllocationMetadata {
  return {
    availableMembers: Object.keys(after),
    generatedAt: '2026-08-16T12:00:00.000Z',
    balancesBefore: before,
    balancesAfter: after,
  };
}

function snapshot(weekStart: string, metadata: WeeklyAllocationMetadata): WeeklySnapshot {
  return {
    id: weekStart,
    weekId: weekStart,
    weekStart,
    weekLabel: weekStart,
    createdAt: `${weekStart}T00:00:00.000Z`,
    isCanon: true,
    rosters: DEFAULT_ROSTERS,
    allocation: metadata,
  };
}

describe('selectPriorFairRosterBalances', () => {
  it('uses balances-before when regenerating the same week', () => {
    const before = { ada: { workload: -1, cooking: 0, cleaning: -0.5 } };
    const after = { ada: { workload: 2, cooking: 1, cleaning: 0.5 } };

    expect(selectPriorFairRosterBalances({
      targetWeekStart: '2026-08-19',
      activeWeekStart: '2026-08-16',
      activeAllocation: allocation(before, after),
    })).toEqual(before);
  });

  it('uses the closest earlier balances-after ledger for a new week', () => {
    const firstAfter = { ada: { workload: 2, cooking: 1, cleaning: 0.5 } };
    const latestAfter = {
      ada: { workload: 1, cooking: 0, cleaning: 0 },
      bola: { workload: -1, cooking: 0, cleaning: 0 },
    };
    const snapshots = [
      snapshot('2026-08-09', allocation({}, firstAfter)),
      snapshot('2026-08-16', allocation(firstAfter, latestAfter)),
    ];

    expect(selectPriorFairRosterBalances({
      targetWeekStart: '2026-08-23',
      snapshots,
    })).toEqual(latestAfter);
  });

  it('clones saved ledgers and starts clean when no earlier week exists', () => {
    const after = { ada: { workload: 1, cooking: 0, cleaning: 0 } };
    const metadata = allocation({}, after);
    const result = selectPriorFairRosterBalances({
      targetWeekStart: '2026-08-23',
      activeWeekStart: '2026-08-16',
      activeAllocation: metadata,
    });
    result.ada.workload = 99;

    expect((metadata.balancesAfter as typeof after).ada.workload).toBe(1);
    expect(selectPriorFairRosterBalances({
      targetWeekStart: '2026-08-02',
      activeWeekStart: '2026-08-16',
      activeAllocation: metadata,
    })).toEqual({});
  });
});

