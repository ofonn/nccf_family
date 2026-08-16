import { describe, expect, it } from 'vitest';
import { DEFAULT_ROSTERS } from './constants';
import {
  normalizeWeeklySnapshots,
  upsertWeeklySnapshot,
} from './historyManager';
import type { WeeklyAllocationMetadata, WeeklySnapshot } from './types';

function allocation(
  availableMembers: string[],
  seed: string,
): WeeklyAllocationMetadata {
  return {
    availableMembers,
    generatedAt: '2026-08-16T12:00:00.000Z',
    seed,
    weights: { cleaning: 1, cooking: 4 },
    nextBalances: Object.fromEntries(
      availableMembers.map((member) => [member, { workload: 0, cooking: 0, cleaning: 0 }]),
    ),
  };
}

describe('weekly roster history', () => {
  it('keeps history normalization read-only and never invents a snapshot', () => {
    const source: WeeklySnapshot[] = [];

    expect(normalizeWeeklySnapshots(source)).toEqual([]);
    expect(source).toEqual([]);
  });

  it('replaces a same-week publication instead of double-counting it', () => {
    const firstRosters = structuredClone(DEFAULT_ROSTERS);
    const secondRosters = structuredClone(DEFAULT_ROSTERS);
    secondRosters.cleaning_roster.rows[0].person = 'Replacement Member';

    const first = upsertWeeklySnapshot([], firstRosters, {
      weekStart: '2026-08-19',
      allocation: allocation(['Ada', 'Bola'], 'first-seed'),
      now: new Date('2026-08-16T10:00:00.000Z'),
    });
    const second = upsertWeeklySnapshot(first, secondRosters, {
      weekStart: '2026-08-16',
      allocation: allocation(['Ada', 'Bola'], 'second-seed'),
      now: new Date('2026-08-17T10:00:00.000Z'),
    });

    expect(second).toHaveLength(1);
    expect(second[0].weekId).toBe('2026-08-16');
    expect(second[0].createdAt).toBe('2026-08-16T10:00:00.000Z');
    expect(second[0].updatedAt).toBe('2026-08-17T10:00:00.000Z');
    expect(second[0].rosters.cleaning_roster.rows[0].person).toBe('Replacement Member');
    expect(second[0].allocation?.seed).toBe('second-seed');
  });

  it('preserves both weeks during a target-week rollover', () => {
    const weekOne = upsertWeeklySnapshot([], DEFAULT_ROSTERS, {
      weekStart: '2026-08-16',
      now: new Date('2026-08-16T10:00:00.000Z'),
    });
    const weekTwo = upsertWeeklySnapshot(weekOne, DEFAULT_ROSTERS, {
      weekStart: '2026-08-23',
      now: new Date('2026-08-23T10:00:00.000Z'),
    });

    expect(weekTwo.map((snapshot) => snapshot.weekId)).toEqual([
      '2026-08-23',
      '2026-08-16',
    ]);
  });

  it('applies Praise Night and calendar-correct last-Friday activity rules', () => {
    const snapshots = upsertWeeklySnapshot([], DEFAULT_ROSTERS, {
      weekStart: '2026-08-23',
    });
    const prayerRows = snapshots[0].rosters.prayer_roster.rows;
    const fridayEvening = prayerRows.find(
      (row) => row.day === 'Friday' && row.event !== 'Morning Prayer',
    );
    const saturdayEvening = prayerRows.find(
      (row) => row.day === 'Saturday' && row.event !== 'Morning Prayer',
    );

    expect(fridayEvening).toMatchObject({
      event: 'Game Night',
      time: '09:00 PM – 11:00 PM',
    });
    expect(saturdayEvening?.event).toBe('Praise Night');
  });

  it('converts legacy week IDs and collapses duplicate legacy revisions', () => {
    const original: WeeklySnapshot = {
      id: 'snapshot_2026-W01',
      weekId: '2026-W01',
      weekLabel: 'legacy label',
      createdAt: '2026-01-04T08:00:00.000Z',
      isCanon: true,
      rosters: structuredClone(DEFAULT_ROSTERS),
    };
    const newer = structuredClone(original);
    newer.id = 'another-id-for-the-same-week';
    newer.createdAt = '2026-01-05T08:00:00.000Z';
    newer.rosters.cleaning_roster.rows[0].person = 'Latest Revision';

    const normalized = normalizeWeeklySnapshots([original, newer]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      id: 'snapshot_2026-01-04',
      weekId: '2026-01-04',
      weekStart: '2026-01-04',
    });
    expect(normalized[0].rosters.cleaning_roster.rows[0].person).toBe('Latest Revision');
  });

  it('retains, replaces, and explicitly clears allocation metadata', () => {
    const initialAllocation = allocation(['Ada', 'Bola'], 'initial');
    const replacementAllocation = allocation(['Ada', 'Chidi'], 'replacement');
    const first = upsertWeeklySnapshot([], DEFAULT_ROSTERS, {
      weekStart: '2026-08-16',
      allocation: initialAllocation,
    });
    const retained = upsertWeeklySnapshot(first, DEFAULT_ROSTERS, {
      weekStart: '2026-08-16',
    });
    const replaced = upsertWeeklySnapshot(retained, DEFAULT_ROSTERS, {
      weekStart: '2026-08-16',
      allocation: replacementAllocation,
    });
    const cleared = upsertWeeklySnapshot(replaced, DEFAULT_ROSTERS, {
      weekStart: '2026-08-16',
      allocation: null,
    });

    expect(retained[0].allocation).toEqual(initialAllocation);
    expect(replaced[0].allocation).toEqual(replacementAllocation);
    expect(cleared[0].allocation).toBeUndefined();
  });
});
