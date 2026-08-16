import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeRosterActivities,
  upsertWeeklySnapshot,
} from '@/lib/historyManager';
import {
  isRosterPersistenceError,
  loadRosterData,
  saveRosterData,
} from '@/lib/server/rosterDataStore';

const HASHES = {
  master: '9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a',
  prayer_coordinator: '559cbfb727a428db14c17b3a925c201ac283e3800b3e034f55153077d8d56e29',
};

interface HistoryActionBody {
  action?: 'rollback' | 'apply_snapshot';
  snapshotId?: string;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isAuthorized(request: NextRequest): boolean {
  const passwordHash = sha256(request.headers.get('x-auth-password') || '');
  return passwordHash === HASHES.master || passwordHash === HASHES.prayer_coordinator;
}

function persistenceErrorResponse(error: unknown) {
  if (isRosterPersistenceError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error('History API error:', error);
  return NextResponse.json(
    { error: 'Failed to process roster history.' },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const data = await loadRosterData();

    // Deliberately read-only: archives are created by authenticated publishes.
    return NextResponse.json(
      {
        previousSave: data.previousSave,
        snapshots: data.snapshots,
        activeWeekId: data.activeWeekId,
        activeWeekStart: data.activeWeekStart,
        activeAllocation: data.activeAllocation || null,
      },
      {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      },
    );
  } catch (error) {
    return persistenceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized access. Invalid password.' },
      { status: 401 },
    );
  }

  let body: HistoryActionBody;
  try {
    body = (await request.json()) as HistoryActionBody;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  try {
    const data = await loadRosterData();
    const currentRosters = data.rosters;

    if (body.action === 'rollback') {
      if (!data.previousSave) {
        return NextResponse.json(
          { error: 'No previous save available to revert.' },
          { status: 400 },
        );
      }

      const currentWeekStart = data.activeWeekStart;
      const currentAllocation = data.activeAllocation || null;
      // Never guess the week of a legacy rollback state. In particular, after
      // applying an archive to an unversioned live board, such a guess could
      // overwrite that archive with unrelated legacy data.
      const targetWeekStart = data.previousSaveWeekStart;
      const targetAllocation = data.previousSaveAllocation || null;
      const targetRosters = normalizeRosterActivities(data.previousSave, targetWeekStart);

      data.rosters = targetRosters;
      data.previousSave = structuredClone(currentRosters);
      data.previousSaveWeekStart = currentWeekStart;
      data.previousSaveWeekId = currentWeekStart;
      data.previousSaveAllocation = currentAllocation;
      data.activeWeekStart = targetWeekStart;
      data.activeWeekId = targetWeekStart;
      data.activeAllocation = targetAllocation;

      if (targetWeekStart) {
        data.snapshots = upsertWeeklySnapshot(data.snapshots, targetRosters, {
          weekStart: targetWeekStart,
          allocation: targetAllocation,
        });
      }

      await saveRosterData(data);
      return NextResponse.json({
        success: true,
        message: 'Reverted live schedule to the previous saved state.',
        rosters: targetRosters,
        activeWeekId: data.activeWeekId,
        activeWeekStart: data.activeWeekStart,
        activeAllocation: data.activeAllocation || null,
      });
    }

    if (body.action === 'apply_snapshot') {
      if (!body.snapshotId) {
        return NextResponse.json({ error: 'snapshotId is required.' }, { status: 400 });
      }

      const found = data.snapshots.find(
        (snapshot) =>
          snapshot.id === body.snapshotId ||
          snapshot.weekId === body.snapshotId ||
          snapshot.weekStart === body.snapshotId,
      );
      if (!found || !found.weekStart) {
        return NextResponse.json({ error: 'Snapshot not found.' }, { status: 404 });
      }

      // Preserve the current published week before changing the live board.
      if (data.activeWeekStart) {
        data.snapshots = upsertWeeklySnapshot(data.snapshots, currentRosters, {
          weekStart: data.activeWeekStart,
          allocation: data.activeAllocation || null,
        });
      }

      const targetRosters = normalizeRosterActivities(found.rosters, found.weekStart);
      data.previousSave = structuredClone(currentRosters);
      data.previousSaveWeekStart = data.activeWeekStart;
      data.previousSaveWeekId = data.activeWeekId;
      data.previousSaveAllocation = data.activeAllocation || null;
      data.rosters = targetRosters;
      data.activeWeekStart = found.weekStart;
      data.activeWeekId = found.weekId;
      data.activeAllocation = found.allocation ? structuredClone(found.allocation) : null;

      await saveRosterData(data);
      return NextResponse.json({
        success: true,
        message: `Applied ${found.weekLabel} snapshot to the live schedule board.`,
        rosters: targetRosters,
        activeWeekId: found.weekId,
        activeWeekStart: found.weekStart,
        activeAllocation: data.activeAllocation || null,
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    return persistenceErrorResponse(error);
  }
}
