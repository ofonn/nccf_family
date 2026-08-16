import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import {
  normalizeRosterActivities,
  upsertWeeklySnapshot,
} from '@/lib/historyManager';
import {
  isAllocationMetadata,
  isRosterPersistenceError,
  isRostersMap,
  loadRosterData,
  saveRosterData,
} from '@/lib/server/rosterDataStore';
import type { AuthRole, RostersMap, WeeklyAllocationMetadata } from '@/lib/types';
import { getCurrentSundayISO, normalizeToSundayISO } from '@/lib/rosterCalendar';

const HASHES = {
  master: '9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a',
  prayer_coordinator: '559cbfb727a428db14c17b3a925c201ac283e3800b3e034f55153077d8d56e29',
};

interface PublishRostersRequest {
  rosters: RostersMap;
  /** Any date in the requested Sunday-to-Saturday week. */
  weekStart?: string;
  /** Backwards-compatible alias accepted by early generator prototypes. */
  targetWeekStart?: string;
  allocation?: WeeklyAllocationMetadata | null;
}

interface ParsedPublishRequest {
  rosters: RostersMap;
  requestedWeekStart?: string;
  allocation: WeeklyAllocationMetadata | null;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getAuthRole(request: NextRequest): Exclude<AuthRole, 'none'> | null {
  const passwordHash = sha256(request.headers.get('x-auth-password') || '');
  if (passwordHash === HASHES.master) return 'master';
  if (passwordHash === HASHES.prayer_coordinator) return 'prayer_coordinator';
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parsePublishRequest(value: unknown): ParsedPublishRequest | null {
  // Keep the existing raw RostersMap request working. A raw save has no
  // allocator metadata, so any stale active calculation is deliberately reset.
  if (isRostersMap(value)) {
    return { rosters: value, allocation: null };
  }

  if (!isRecord(value) || !isRostersMap(value.rosters)) return null;

  const envelope = value as unknown as PublishRostersRequest;
  const requestedWeekStart = envelope.weekStart || envelope.targetWeekStart;
  if (requestedWeekStart !== undefined && typeof requestedWeekStart !== 'string') {
    return null;
  }

  if (
    envelope.allocation !== undefined &&
    envelope.allocation !== null &&
    !isAllocationMetadata(envelope.allocation)
  ) {
    return null;
  }

  return {
    rosters: envelope.rosters,
    requestedWeekStart,
    allocation: envelope.allocation || null,
  };
}

function mergeAuthorizedRosters(
  currentRosters: RostersMap,
  requestedRosters: RostersMap,
  authRole: Exclude<AuthRole, 'none'>,
): RostersMap {
  if (authRole === 'master') return structuredClone(requestedRosters);

  return {
    ...structuredClone(currentRosters),
    prayer_roster: structuredClone(requestedRosters.prayer_roster),
    glorious_service: structuredClone(requestedRosters.glorious_service),
    cooking_roster: structuredClone(requestedRosters.cooking_roster),
  };
}

function persistenceErrorResponse(error: unknown) {
  if (isRosterPersistenceError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error('Roster API error:', error);
  return NextResponse.json({ error: 'Failed to process roster request.' }, { status: 500 });
}

export async function GET() {
  try {
    const data = await loadRosterData();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    return persistenceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const authRole = getAuthRole(request);
  if (!authRole) {
    return NextResponse.json(
      { error: 'Unauthorized access. Invalid password.' },
      { status: 401 },
    );
  }

  try {
    const currentData = await loadRosterData();
    const action = request.headers.get('x-action') || '';

    if (action === 'reset') {
      if (authRole !== 'master') {
        return NextResponse.json(
          { error: 'Forbidden. Only Master Admin can reset schedules.' },
          { status: 403 },
        );
      }

      const weekStart = getCurrentSundayISO();
      if (currentData.activeWeekStart && currentData.activeWeekStart !== weekStart) {
        currentData.snapshots = upsertWeeklySnapshot(
          currentData.snapshots,
          currentData.rosters,
          {
            weekStart: currentData.activeWeekStart,
            allocation: currentData.activeAllocation || null,
          },
        );
      }

      const resetRosters = normalizeRosterActivities(DEFAULT_ROSTERS, weekStart);
      currentData.previousSave = structuredClone(currentData.rosters);
      currentData.previousSaveWeekStart = currentData.activeWeekStart;
      currentData.previousSaveWeekId = currentData.activeWeekId;
      currentData.previousSaveAllocation = currentData.activeAllocation || null;
      currentData.rosters = resetRosters;
      currentData.activeWeekStart = weekStart;
      currentData.activeWeekId = weekStart;
      currentData.activeAllocation = null;
      currentData.snapshots = upsertWeeklySnapshot(
        currentData.snapshots,
        resetRosters,
        { weekStart, allocation: null },
      );

      const saved = await saveRosterData(currentData);
      return NextResponse.json({
        success: true,
        message: 'Rosters reset to defaults.',
        rosters: saved.rosters,
        activeWeekId: saved.activeWeekId,
        activeWeekStart: saved.activeWeekStart,
        activeAllocation: saved.activeAllocation || null,
      });
    }

    let requestJson: unknown;
    try {
      requestJson = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }

    const publish = parsePublishRequest(requestJson);
    if (!publish) {
      return NextResponse.json(
        {
          error:
            'Invalid roster payload. Send a RostersMap or { rosters, weekStart, allocation }.',
        },
        { status: 400 },
      );
    }

    let weekStart: string;
    try {
      weekStart = normalizeToSundayISO(
        publish.requestedWeekStart || getCurrentSundayISO(),
      );
    } catch {
      return NextResponse.json(
        { error: 'weekStart must be a valid date in YYYY-MM-DD format.' },
        { status: 400 },
      );
    }

    // Complete the outgoing archive before switching the active target week.
    if (currentData.activeWeekStart && currentData.activeWeekStart !== weekStart) {
      currentData.snapshots = upsertWeeklySnapshot(
        currentData.snapshots,
        currentData.rosters,
        {
          weekStart: currentData.activeWeekStart,
          allocation: currentData.activeAllocation || null,
        },
      );
    }

    const mergedRosters = mergeAuthorizedRosters(
      currentData.rosters,
      publish.rosters,
      authRole,
    );
    const publishedRosters = normalizeRosterActivities(mergedRosters, weekStart);
    // The generator UI remains master-only, but a prayer coordinator may edit
    // an already-generated prayer/cooking roster. Its client reconciles the
    // workload metadata so the long-term carry-over ledger is not erased.
    const allocation = publish.allocation;

    currentData.previousSave = structuredClone(currentData.rosters);
    currentData.previousSaveWeekStart = currentData.activeWeekStart;
    currentData.previousSaveWeekId = currentData.activeWeekId;
    currentData.previousSaveAllocation = currentData.activeAllocation || null;
    currentData.rosters = publishedRosters;
    currentData.activeWeekStart = weekStart;
    currentData.activeWeekId = weekStart;
    currentData.activeAllocation = allocation;
    currentData.snapshots = upsertWeeklySnapshot(
      currentData.snapshots,
      publishedRosters,
      { weekStart, allocation },
    );

    const saved = await saveRosterData(currentData);
    const snapshot = saved.snapshots.find((item) => item.weekId === weekStart);

    return NextResponse.json({
      success: true,
      message: 'Rosters and weekly history saved successfully.',
      authLevel: authRole,
      rosters: saved.rosters,
      activeWeekId: saved.activeWeekId,
      activeWeekStart: saved.activeWeekStart,
      activeAllocation: saved.activeAllocation || null,
      snapshot,
    });
  } catch (error) {
    return persistenceErrorResponse(error);
  }
}
