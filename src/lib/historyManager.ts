import type {
  RostersMap,
  WeeklyAllocationMetadata,
  WeeklySnapshot,
} from '@/lib/types';
import {
  applyWeeklyActivityRules,
  getCurrentSundayISO,
  getWeekLabel,
  normalizeToSundayISO,
} from '@/lib/rosterCalendar';

const LEGACY_WEEK_ID_PATTERN = /^(\d{4})-W(\d{2})$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface WeekDetails {
  weekId: string;
  weekLabel: string;
  weekStart: string;
  sundayISO: string;
}

export interface UpsertWeeklySnapshotOptions {
  weekStart: string;
  allocation?: WeeklyAllocationMetadata | null;
  now?: Date;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isoTimestampIsValid(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert the old custom `YYYY-Wnn` archive key to the Sunday that started
 * that week. The former implementation counted from the year's first Sunday.
 */
function legacyWeekIdToSunday(weekId: string): string | null {
  const match = LEGACY_WEEK_ID_PATTERN.exec(weekId);
  if (!match) return null;

  const year = Number(match[1]);
  const weekNumber = Number(match[2]);
  if (weekNumber < 1 || weekNumber > 54) return null;

  const yearStart = new Date(Date.UTC(year, 0, 1, 12));
  const daysUntilSunday = (7 - yearStart.getUTCDay()) % 7;
  yearStart.setUTCDate(yearStart.getUTCDate() + daysUntilSunday + (weekNumber - 1) * 7);
  return formatDateOnly(yearStart);
}

export function getSundayWeekDetails(d = new Date()): WeekDetails {
  return getWeekDetails(getCurrentSundayISO(d));
}

export function getWeekDetails(requestedWeekStart: string): WeekDetails {
  const weekStart = normalizeToSundayISO(requestedWeekStart);
  return {
    weekId: weekStart,
    weekLabel: getWeekLabel(weekStart),
    weekStart,
    sundayISO: `${weekStart}T00:00:00.000Z`,
  };
}

export function getSnapshotWeekStart(snapshot: WeeklySnapshot): string {
  if (snapshot.weekStart && DATE_ONLY_PATTERN.test(snapshot.weekStart)) {
    return normalizeToSundayISO(snapshot.weekStart);
  }

  if (DATE_ONLY_PATTERN.test(snapshot.weekId)) {
    return normalizeToSundayISO(snapshot.weekId);
  }

  const legacyWeekStart = legacyWeekIdToSunday(snapshot.weekId);
  if (legacyWeekStart) return legacyWeekStart;

  if (isoTimestampIsValid(snapshot.createdAt)) {
    return getCurrentSundayISO(new Date(snapshot.createdAt));
  }

  throw new Error(`Snapshot ${snapshot.id || snapshot.weekId} has no valid week date.`);
}

/**
 * Migrate schedule labels without mutating caller-owned data. Calendar rules
 * are only applied when an explicit/derived week is trustworthy.
 */
export function normalizeRosterActivities(
  source: RostersMap,
  weekStart?: string,
): RostersMap {
  const rosters = clone(source);

  const fridayEvening = rosters.prayer_roster?.rows.find(
    (row) => row.day === 'Friday' && row.event !== 'Morning Prayer',
  );
  if (fridayEvening?.event === 'Discussion Night') {
    fridayEvening.time = '08:30 PM – 09:00 PM';
  }

  const saturdayEvening = rosters.prayer_roster?.rows.find(
    (row) => row.day === 'Saturday' && row.event !== 'Morning Prayer',
  );
  if (saturdayEvening) {
    saturdayEvening.event = 'Praise Night';
  }

  return weekStart
    ? applyWeeklyActivityRules(rosters, normalizeToSundayISO(weekStart))
    : rosters;
}

function normalizeSnapshot(snapshot: WeeklySnapshot): WeeklySnapshot {
  const weekStart = getSnapshotWeekStart(snapshot);
  const details = getWeekDetails(weekStart);
  const createdAt = isoTimestampIsValid(snapshot.createdAt)
    ? snapshot.createdAt
    : new Date().toISOString();

  return {
    ...clone(snapshot),
    id: `snapshot_${details.weekId}`,
    weekId: details.weekId,
    weekStart: details.weekStart,
    weekLabel: details.weekLabel,
    createdAt,
    isCanon: true,
    rosters: normalizeRosterActivities(snapshot.rosters, details.weekStart),
  };
}

function snapshotRevisionTime(snapshot: WeeklySnapshot): number {
  const timestamp = snapshot.updatedAt || snapshot.createdAt;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Normalize legacy snapshots and collapse duplicate entries for a week. The
 * latest revision wins, which prevents historical workload from being counted
 * twice after a same-week re-publication.
 */
export function normalizeWeeklySnapshots(
  snapshots: WeeklySnapshot[] | null | undefined,
): WeeklySnapshot[] {
  const latestByWeek = new Map<string, WeeklySnapshot>();

  for (const source of snapshots || []) {
    if (!source?.rosters || !source.weekId) continue;

    try {
      const snapshot = normalizeSnapshot(source);
      const existing = latestByWeek.get(snapshot.weekId);
      if (!existing || snapshotRevisionTime(snapshot) >= snapshotRevisionTime(existing)) {
        latestByWeek.set(snapshot.weekId, snapshot);
      }
    } catch (error) {
      console.warn('Ignoring invalid weekly snapshot:', error);
    }
  }

  return Array.from(latestByWeek.values()).sort((a, b) =>
    (b.weekStart || b.weekId).localeCompare(a.weekStart || a.weekId),
  );
}

export function upsertWeeklySnapshot(
  existingSnapshots: WeeklySnapshot[],
  rosters: RostersMap,
  options: UpsertWeeklySnapshotOptions,
): WeeklySnapshot[] {
  const snapshots = normalizeWeeklySnapshots(existingSnapshots);
  const details = getWeekDetails(options.weekStart);
  const existing = snapshots.find((snapshot) => snapshot.weekId === details.weekId);
  const now = (options.now || new Date()).toISOString();

  const snapshot: WeeklySnapshot = {
    id: `snapshot_${details.weekId}`,
    weekId: details.weekId,
    weekStart: details.weekStart,
    weekLabel: details.weekLabel,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    isCanon: true,
    rosters: normalizeRosterActivities(rosters, details.weekStart),
  };

  if (options.allocation === undefined && existing?.allocation) {
    snapshot.allocation = clone(existing.allocation);
  } else if (options.allocation) {
    snapshot.allocation = clone(options.allocation);
  }

  return [
    snapshot,
    ...snapshots.filter((item) => item.weekId !== details.weekId),
  ].sort((a, b) => (b.weekStart || b.weekId).localeCompare(a.weekStart || a.weekId));
}

/**
 * Backwards-compatible pure helper. Persistence belongs to the authenticated
 * publish route; a GET request must never create an archive as a side effect.
 */
export function processWeeklySnapshots(
  existingSnapshots: WeeklySnapshot[],
  currentRosters: RostersMap,
  d = new Date(),
): WeeklySnapshot[] {
  return upsertWeeklySnapshot(existingSnapshots, currentRosters, {
    weekStart: getCurrentSundayISO(d),
  });
}
