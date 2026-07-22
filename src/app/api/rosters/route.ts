import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import https from 'https';
import { DEFAULT_ROSTERS } from '@/lib/constants';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\s+/g, '');
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').replace(/\s+/g, '');

const HASHES = {
  master: "9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a", // nccfadmin
  prayer_coordinator: "559cbfb727a428db14c17b3a925c201ac283e3800b3e034f55153077d8d56e29" // nccfprayer
};

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Custom HTTPS request forcing IPv4 to eliminate Node.js 30s IPv6 timeout
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

async function loadRostersFromSupabase() {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const res = await fetchIPv4(`${SUPABASE_URL}/rest/v1/rosters_data?id=eq.1&select=data`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      });
      const data = await res.json();
      if (data && data.length > 0 && data[0].data && data[0].data.rosters) {
        return data[0].data;
      }
    } catch (e) {
      console.error("Supabase fetch failed, fallback to defaults:", e);
    }
  }
  return { rosters: DEFAULT_ROSTERS, lastUpdated: new Date().toISOString() };
}

async function saveRostersToSupabase(payload: any) {
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
  const data = await loadRostersFromSupabase();
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get('x-auth-password') || '';
    const actionHeader = req.headers.get('x-action') || '';
    const inputHash = sha256(password);

    let authLevel: 'master' | 'prayer_coordinator' | null = null;
    if (inputHash === HASHES.master) authLevel = 'master';
    else if (inputHash === HASHES.prayer_coordinator) authLevel = 'prayer_coordinator';

    if (!authLevel) {
      return NextResponse.json({ error: "Unauthorized access. Invalid password." }, { status: 401 });
    }

    if (actionHeader === 'reset') {
      if (authLevel !== 'master') {
        return NextResponse.json({ error: "Forbidden. Only Master Admin can reset schedules." }, { status: 403 });
      }
      const resetData = { rosters: DEFAULT_ROSTERS, lastUpdated: new Date().toISOString() };
      await saveRostersToSupabase(resetData);
      return NextResponse.json({ success: true, message: "Rosters reset to defaults." });
    }

    const newPayload = await req.json();
    const currentData = await loadRostersFromSupabase();
    let newRosters = currentData.rosters || {};

    if (authLevel === 'master') {
      newRosters = newPayload;
    } else if (authLevel === 'prayer_coordinator') {
      newRosters.prayer_roster = newPayload.prayer_roster;
    }

    const fileData = { rosters: newRosters, lastUpdated: new Date().toISOString() };
    await saveRostersToSupabase(fileData);

    return NextResponse.json({ success: true, message: "Rosters saved successfully.", authLevel });
  } catch (e: any) {
    console.error("Save API error:", e);
    return NextResponse.json({ error: `Failed to save request: ${e.message}` }, { status: 500 });
  }
}
