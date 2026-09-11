import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROSTERS } from '../constants';
import {
  loadRosterData,
  normalizeStoredRosterData,
  saveRosterData,
} from './rosterDataStore';

const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_KEY;

afterEach(() => {
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;

  if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_KEY;
  else process.env.SUPABASE_SERVICE_KEY = originalServiceKey;
});

describe('roster data persistence normalization', () => {
  it('migrates old live labels but does not manufacture history during a read', () => {
    const legacyRosters = structuredClone(DEFAULT_ROSTERS);
    const fridayEvening = legacyRosters.prayer_roster.rows.find(
      (row) => row.day === 'Friday' && row.event !== 'Morning Prayer',
    );
    const saturdayEvening = legacyRosters.prayer_roster.rows.find(
      (row) => row.day === 'Saturday' && row.event !== 'Morning Prayer',
    );
    if (fridayEvening) fridayEvening.time = '08:30 PM';
    if (saturdayEvening) saturdayEvening.event = 'Praise & Worship';

    const normalized = normalizeStoredRosterData({
      rosters: legacyRosters,
      snapshots: [],
      previousSave: null,
      lastUpdated: '2026-08-16T10:00:00.000Z',
    });

    expect(normalized.snapshots).toEqual([]);
    expect(normalized.activeWeekStart).toBeUndefined();
    expect(fridayEvening?.time).toBe('08:30 PM');
    expect(normalized.rosters.prayer_roster.rows.find(
      (row) => row.day === 'Friday' && row.event !== 'Morning Prayer',
    )?.time).toBe('08:30 PM – 09:00 PM');
    expect(normalized.rosters.prayer_roster.rows.find(
      (row) => row.day === 'Saturday' && row.event !== 'Morning Prayer',
    )?.event).toBe('Praise Night');
  });

  it('fails reads and writes clearly when Supabase is not configured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    const data = normalizeStoredRosterData({ rosters: DEFAULT_ROSTERS });

    await expect(loadRosterData()).rejects.toMatchObject({
      code: 'PERSISTENCE_NOT_CONFIGURED',
      status: 503,
    });
    await expect(saveRosterData(data)).rejects.toMatchObject({
      code: 'PERSISTENCE_NOT_CONFIGURED',
      status: 503,
    });
  });
});
