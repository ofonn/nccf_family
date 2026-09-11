import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import { generateFairRoster } from '@/lib/fairRoster';
import { normalizeStoredRosterData } from '@/lib/server/rosterDataStore';
import type { StoredRosterData } from '@/lib/server/rosterDataStore';
import type { WeeklyAllocationMetadata } from '@/lib/types';

const persistence = vi.hoisted(() => ({
  load: vi.fn<() => Promise<StoredRosterData>>(),
  save: vi.fn<(data: StoredRosterData) => Promise<StoredRosterData>>(),
}));

vi.mock('@/lib/server/rosterDataStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/rosterDataStore')>();
  return {
    ...actual,
    loadRosterData: persistence.load,
    saveRosterData: persistence.save,
  };
});

import { GET, POST } from './route';

const MASTER_PASSWORD = 'nccfadmin';
const PRAYER_COORDINATOR_PASSWORD = 'nccfprayer';

function metadata(seed: string): WeeklyAllocationMetadata {
  return {
    availableMembers: ['Ada', 'Bola'],
    generatedAt: '2026-08-16T12:00:00.000Z',
    seed,
    nextBalances: {
      Ada: { workload: 0, cooking: 0, cleaning: 0 },
      Bola: { workload: 0, cooking: 0, cleaning: 0 },
    },
  };
}

function publishRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/rosters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-password': MASTER_PASSWORD,
    },
    body: JSON.stringify(body),
  });
}

function coordinatorPublishRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/rosters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-password': PRAYER_COORDINATOR_PASSWORD,
    },
    body: JSON.stringify(body),
  });
}

describe('roster publication route', () => {
  let persisted: StoredRosterData;

  beforeEach(() => {
    persisted = normalizeStoredRosterData({
      rosters: DEFAULT_ROSTERS,
      previousSave: null,
      snapshots: [],
      lastUpdated: '2026-08-16T09:00:00.000Z',
    });
    persistence.load.mockReset();
    persistence.save.mockReset();
    persistence.load.mockImplementation(async () => structuredClone(persisted));
    persistence.save.mockImplementation(async (data) => {
      persisted = normalizeStoredRosterData(data);
      return structuredClone(persisted);
    });
  });

  it('publishes and reloads a flexible roster with its exceptions', async () => {
    const generated = generateFairRoster({ rosters: DEFAULT_ROSTERS,
      members: ['Ada', 'Bola', 'Chidi'].map((name) => ({ id: name, name })),
      flexible: true, weekStart: '2026-09-13', seed: 'publish-flexible' });
    const response = await POST(publishRequest({ rosters: generated.rosters,
      weekStart: '2026-09-13', allocation: generated.metadata }));
    expect(response.status).toBe(200);
    const loaded = await (await GET()).json();
    expect(loaded.rosters).toEqual(generated.rosters);
    expect(loaded.activeAllocation.flexible).toBe(true);
    expect(loaded.activeAllocation.relaxedRules).toEqual(generated.metadata.relaxedRules);
    expect(loaded.snapshots[0].allocation.relaxedRules.length).toBeGreaterThan(0);
  });

  it('persists one revision per week and keeps GET read-only', async () => {
    const firstResponse = await POST(publishRequest({
      rosters: DEFAULT_ROSTERS,
      weekStart: '2026-08-16',
      allocation: metadata('first'),
    }));
    expect(firstResponse.status).toBe(200);
    expect(persisted.snapshots).toHaveLength(1);
    expect(persisted.snapshots[0].allocation?.seed).toBe('first');

    const revisedRosters = structuredClone(DEFAULT_ROSTERS);
    revisedRosters.cleaning_roster.rows[0].person = 'Revised Member';
    const revisionResponse = await POST(publishRequest({
      rosters: revisedRosters,
      weekStart: '2026-08-19',
      allocation: metadata('revision'),
    }));
    expect(revisionResponse.status).toBe(200);
    expect(persisted.snapshots).toHaveLength(1);
    expect(persisted.snapshots[0].allocation?.seed).toBe('revision');
    expect(persisted.snapshots[0].rosters.cleaning_roster.rows[0].person)
      .toBe('Revised Member');

    const nextWeekResponse = await POST(publishRequest({
      rosters: DEFAULT_ROSTERS,
      weekStart: '2026-08-23',
      allocation: metadata('next-week'),
    }));
    expect(nextWeekResponse.status).toBe(200);
    expect(persisted.snapshots.map((snapshot) => snapshot.weekId)).toEqual([
      '2026-08-23',
      '2026-08-16',
    ]);

    const writesBeforeGet = persistence.save.mock.calls.length;
    const getResponse = await GET();
    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.snapshots).toHaveLength(2);
    expect(getBody.activeAllocation.seed).toBe('next-week');
    expect(persistence.save).toHaveBeenCalledTimes(writesBeforeGet);
  });

  it('returns a validation error without saving malformed allocation metadata', async () => {
    const response = await POST(publishRequest({
      rosters: DEFAULT_ROSTERS,
      weekStart: '2026-08-16',
      allocation: { availableMembers: 'Ada' },
    }));

    expect(response.status).toBe(400);
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it('keeps carry-over metadata when a coordinator edits an allowed roster', async () => {
    const revisedRosters = structuredClone(DEFAULT_ROSTERS);
    revisedRosters.prayer_roster.rows[0].person = 'Bola';
    revisedRosters.cleaning_roster.rows[0].person = 'Forbidden Cleaning Edit';

    const response = await POST(coordinatorPublishRequest({
      rosters: revisedRosters,
      weekStart: '2026-08-16',
      allocation: metadata('coordinator-reconciled'),
    }));

    expect(response.status).toBe(200);
    expect(persisted.rosters.prayer_roster.rows[0].person).toBe('Bola');
    expect(persisted.rosters.cleaning_roster.rows[0].person)
      .toBe(DEFAULT_ROSTERS.cleaning_roster.rows[0].person);
    expect(persisted.activeAllocation?.seed).toBe('coordinator-reconciled');
  });
});
