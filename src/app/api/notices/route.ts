import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import https from 'https';
import { Notice } from '@/lib/types';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\s+/g, '');
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').replace(/\s+/g, '');

const HASHES = {
  master: "9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a",
  prayer_coordinator: "559cbfb727a428db14c17b3a925c201ac283e3800b3e034f55153077d8d56e29"
};

const DEFAULT_NOTICES: Notice[] = [
  {
    id: "notice_august_maintenance",
    title: "August Maintenance Dues",
    category: "Maintenance Dues",
    content: "Good evening @all. How have we been and I hope we are doing fine? Please I want to encourage us to pay our maintenance dues for this coming August. It is this money that we use to help pay for the house rent, light bills and maintain the house. I beg us by the mercies of God let us pay up.",
    amount: "₦3,000",
    accountDetails: "Uche Chidera Joseph | Kuda Bank | 2087338124",
    createdAt: "2026-07-28T10:00:00.000Z"
  },
  {
    id: "notice_food_gas_sub",
    title: "Food Sub & Gas Fee Payment",
    category: "Food & Gas",
    content: "Good day everyone ☺️. Let’s start paying for our food sub and gas fee. All payments should come in on or before the 5th.",
    amount: "₦23,400 Total (Food Sub: ₦22,000 | Gas Fee: ₦1,400)",
    accountDetails: "Ohakwe Miracle | Palmpay | 8084689962 (Ref: food sub)",
    createdAt: "2026-07-27T08:00:00.000Z"
  }
];

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

async function loadFullData() {
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
      console.error("Supabase fetch failed in notices API:", e);
    }
  }
  return { notices: DEFAULT_NOTICES };
}

async function saveFullData(payload: any) {
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
  const data = await loadFullData();
  const notices = data.notices || DEFAULT_NOTICES;
  return NextResponse.json({ notices }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get('x-auth-password') || '';
    const inputHash = sha256(password);
    if (inputHash !== HASHES.master && inputHash !== HASHES.prayer_coordinator) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const { action, notice } = await req.json();
    const data = await loadFullData();
    let currentNotices: Notice[] = data.notices || DEFAULT_NOTICES;

    if (action === 'create') {
      const newNotice: Notice = {
        id: `notice_${Date.now()}`,
        title: notice.title || 'Official Announcement',
        category: notice.category || 'General Notice',
        content: notice.content || '',
        amount: notice.amount || '',
        accountDetails: notice.accountDetails || '',
        createdAt: new Date().toISOString()
      };
      currentNotices = [newNotice, ...currentNotices];
    } else if (action === 'update') {
      currentNotices = currentNotices.map((n) => (n.id === notice.id ? { ...notice, updatedAt: new Date().toISOString() } : n));
    } else if (action === 'delete') {
      currentNotices = currentNotices.filter((n) => n.id !== notice.id);
    }

    data.notices = currentNotices;
    await saveFullData(data);

    return NextResponse.json({ success: true, notices: currentNotices });
  } catch (e: any) {
    console.error("Notices API error:", e);
    return NextResponse.json({ error: `Failed: ${e.message}` }, { status: 500 });
  }
}
