import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import {
  normalizeStoredRosterData,
  type StoredRosterData,
} from '@/lib/server/rosterDataStore';
import { upsertWeeklySnapshot } from '@/lib/historyManager';

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

function actionRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/history', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-password': 'nccfadmin',
    },
    body: JSON.stringify(body),
  });
}

describe('history route', () => {
  let persisted: StoredRosterData;

  beforeEach(() => {
    const archivedRosters = structuredClone(DEFAULT_ROSTERS);
    archivedRosters.cleaning_roster.rows[0].person = 'Archived Member';
    persisted = normalizeStoredRosterData({
      rosters: DEFAULT_ROSTERS,
      previousSave: null,
      snapshots: upsertWeeklySnapshot([], archivedRosters, {
        weekStart: '2026-08-16',
      }),
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

  it('keeps GET read-only', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshots).toHaveLength(1);
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it('applies an archive and safely rolls back an unversioned legacy board', async () => {
    const legacyLivePerson = persisted.rosters.cleaning_roster.rows[0].person;
    const snapshotId = persisted.snapshots[0].id;

    const applyResponse = await POST(actionRequest({
      action: 'apply_snapshot',
      snapshotId,
    }));
    expect(applyResponse.status).toBe(200);
    expect(persisted.rosters.cleaning_roster.rows[0].person).toBe('Archived Member');
    expect(persisted.activeWeekStart).toBe('2026-08-16');

    const rollbackResponse = await POST(actionRequest({ action: 'rollback' }));
    expect(rollbackResponse.status).toBe(200);
    expect(persisted.rosters.cleaning_roster.rows[0].person).toBe(legacyLivePerson);
    expect(persisted.activeWeekStart).toBeUndefined();
    expect(persisted.snapshots).toHaveLength(1);
    expect(persisted.snapshots[0].rosters.cleaning_roster.rows[0].person)
      .toBe('Archived Member');
  });
});
