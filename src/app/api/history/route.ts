import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import https from 'https';
import { DEFAULT_ROSTERS } from '@/lib/constants';
import { processWeeklySnapshots } from '@/lib/historyManager';
import { RostersMap, WeeklySnapshot } from '@/lib/types';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\s+/g, '');
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').replace(/\s+/g, '');

const HASHES = {
  master: "9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a",
  prayer_coordinator: "559cbfb727a428db14c17b3a925c201ac283e3800b3e034f55153077d8d56e29"
};

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function fetchIPv4(url: string, options: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      family: 4
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ ok: res.statusCode! >= 200 && res.statusCode! < 300, status: res.statusCode, json: () => json, text: () => body });
        } catch {
          resolve({ ok: res.statusCode! >= 200 && res.statusCode! < 300, status: res.statusCode, json: () => null, text: () => body });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function loadFullDataFromSupabase() {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const res = await fetchIPv4(`${SUPABASE_URL}/rest/v1/rosters_data?id=eq.1&select=data`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      });
      const data = await res.json();
      if (data && data.length > 0 && data[0].data) {
        return data[0].data;
      }
    } catch (e) {
      console.error("Supabase fetch failed in history API:", e);
    }
  }
  return {
    rosters: DEFAULT_ROSTERS,
    previousSave: null,
    snapshots: [],
    lastUpdated: new Date().toISOString()
  };
}

async function saveFullDataToSupabase(payload: any) {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const res = await fetchIPv4(`${SUPABASE_URL}/rest/v1/rosters_data?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ data: payload, updated_at: new Date().toISOString() })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase PATCH failed: ${res.status} ${errText}`);
    }
  }
}

export async function GET() {
  const fullData = await loadFullDataFromSupabase();
  const currentRosters = fullData.rosters || DEFAULT_ROSTERS;
  const existingSnapshots: WeeklySnapshot[] = fullData.snapshots || [];

  // Ensure current week snapshot exists
  const updatedSnapshots = processWeeklySnapshots(existingSnapshots, currentRosters);

  return NextResponse.json({
    previousSave: fullData.previousSave || null,
    snapshots: updatedSnapshots,
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get('x-auth-password') || '';
    const inputHash = sha256(password);

    let authLevel: 'master' | 'prayer_coordinator' | null = null;
    if (inputHash === HASHES.master) authLevel = 'master';
    else if (inputHash === HASHES.prayer_coordinator) authLevel = 'prayer_coordinator';

    if (!authLevel) {
      return NextResponse.json({ error: "Unauthorized access. Invalid password." }, { status: 401 });
    }

    const { action, snapshotId } = await req.json();
    const fullData = await loadFullDataFromSupabase();
    let currentRosters: RostersMap = fullData.rosters || DEFAULT_ROSTERS;
    let previousSave: RostersMap | null = fullData.previousSave || null;
    let snapshots: WeeklySnapshot[] = fullData.snapshots || [];

    if (action === 'rollback') {
      if (!previousSave) {
        return NextResponse.json({ error: "No previous save available to revert." }, { status: 400 });
      }
      // Revert live schedule to previous save state
      const targetRosters = previousSave;
      const newPreviousSave = JSON.parse(JSON.stringify(currentRosters));

      fullData.rosters = targetRosters;
      fullData.previousSave = newPreviousSave;
      fullData.lastUpdated = new Date().toISOString();

      await saveFullDataToSupabase(fullData);
      return NextResponse.json({ success: true, message: "Reverted live schedule to last saved state.", rosters: targetRosters });
    }

    if (action === 'apply_snapshot') {
      const found = snapshots.find((s) => s.id === snapshotId || s.weekId === snapshotId);
      if (!found) {
        return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
      }

      // Save current state as previous save, and apply snapshot rosters to active live board
      fullData.previousSave = JSON.parse(JSON.stringify(currentRosters));
      fullData.rosters = JSON.parse(JSON.stringify(found.rosters));
      fullData.lastUpdated = new Date().toISOString();

      await saveFullDataToSupabase(fullData);
      return NextResponse.json({
        success: true,
        message: `Applied ${found.weekLabel} snapshot to active live schedule board!`,
        rosters: found.rosters
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (e: any) {
    console.error("History API error:", e);
    return NextResponse.json({ error: `Failed to process history action: ${e.message}` }, { status: 500 });
  }
}
