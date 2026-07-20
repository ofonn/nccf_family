const crypto = require('crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\s+/g, '');
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').replace(/\s+/g, '');

const https = require('https');

// Custom fetch to force IPv4 and bypass Node.js 30-second IPv6 timeout bug
function fetchIPv4(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      family: 4 // FORCE IPv4
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async () => body,
          json: async () => JSON.parse(body)
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

const HASHES = {
  master: "9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a", // nccfadmin
  prayer_coordinator: "559cbfb727a428db14c17b3a925c201ac283e3800b3e034f55153077d8d56e29" // nccfprayer
};

const DEFAULT_ROSTERS = {
  prayer_roster: {
    id: "prayer_roster",
    title: "Prayer Roster",
    icon: "🕯️",
    image: "images/prayer_glow.jpg",
    themeClass: "theme-prayer",
    editableBy: "prayer_coordinator",
    columns: [
      { key: "time", label: "Time", editable: true, isTime: true },
      { key: "event", label: "Event / Theme", editable: true, list: "events" },
      { key: "person", label: "Assigned Person", editable: true, list: "members" }
    ],
    rows: [
      { day: "Monday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Chidera" },
      { day: "Monday", time: "08:30 PM – 09:00 PM", event: "Evening Devotional: Hymns", person: "Mimi" },
      { day: "Tuesday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Segun" },
      { day: "Tuesday", time: "06:00 PM – 07:00 PM", event: "Fasting & Prayer Meeting", person: "Ofonime" },
      { day: "Wednesday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Christopher" },
      { day: "Wednesday", time: "08:30 PM – 09:00 PM", event: "Theme Exposition", person: "Olayinka" },
      { day: "Thursday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Prince" },
      { day: "Thursday", time: "04:30 PM – 06:00 PM", event: "Bible Study", person: "Judith" },
      { day: "Friday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Oluchi" },
      { day: "Friday", time: "08:30 PM", event: "Discussion Night", person: "Ola" },
      { day: "Saturday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Chidera" },
      { day: "Saturday", time: "08:30 PM – 09:00 PM", event: "Praise & Worship", person: "Mimi" }
    ]
  },
  glorious_service: {
    id: "glorious_service",
    title: "Glorious Service Roster",
    icon: "✨",
    image: "images/service_glory.jpg",
    themeClass: "theme-service",
    editableBy: "master",
    columns: [
      { key: "time", label: "Time", editable: true, isTime: true },
      { key: "event", label: "Activity / Event", editable: true, list: "events" },
      { key: "person", label: "Assigned Person", editable: true, list: "members" }
    ],
    rows: [
      { day: "Sunday", time: "04:00 PM – 04:10 PM", event: "Opening prayer", person: "Opeyemi" },
      { day: "Sunday", time: "04:10 PM – 04:30 PM", event: "Praise and Worship", person: "Judith" },
      { day: "Sunday", time: "04:30 PM – 04:40 PM", event: "Testimony", person: "Mimi" },
      { day: "Sunday", time: "04:40 PM – 04:50 PM", event: "Worship again", person: "Olayinka" },
      { day: "Sunday", time: "04:50 PM – 05:30 PM", event: "Word Ministration", person: "Chidera" },
      { day: "Sunday", time: "05:30 PM – 05:40 PM", event: "Announcement", person: "Segun" },
      { day: "Sunday", time: "05:40 PM – 05:50 PM", event: "Offering", person: "Mimi" },
      { day: "Sunday", time: "05:50 PM – 06:00 PM", event: "Benediction", person: "General" }
    ]
  },
  cleaning_roster: {
    id: "cleaning_roster",
    title: "Cleaning Roster",
    icon: "🧹",
    image: "images/clean_vessel.jpg",
    themeClass: "theme-cleaning",
    editableBy: "master",
    columns: [
      { key: "person", label: "Assigned Person", editable: true, list: "members" }
    ],
    rows: [
      { day: "Sunday", person: "-" },
      { day: "Monday", person: "Ofonime" },
      { day: "Tuesday", person: "Christopher" },
      { day: "Wednesday", person: "Segun" },
      { day: "Thursday", person: "Opeyemi" },
      { day: "Friday", person: "Prince" },
      { day: "Saturday", person: "Judith" }
    ]
  },
  cooking_roster: {
    id: "cooking_roster",
    title: "Cooking Roster",
    icon: "🍳",
    image: "images/service_glory.jpg",
    themeClass: "theme-cooking",
    editableBy: "master",
    columns: [
      { key: "person", label: "On Duty", editable: true, list: "members" },
      { key: "breakfast", label: "Breakfast", editable: true, list: "foods" },
      { key: "dinner", label: "Dinner", editable: true, list: "foods" }
    ],
    rows: [
      { day: "Sunday", person: "Judith", breakfast: "Jollof Rice", dinner: "Spag Jollof" },
      { day: "Monday", person: "Opeyemi", breakfast: "Rice & Stew", dinner: "Eba" },
      { day: "Tuesday", person: "Ofonime", breakfast: "Fasting (till evening)", dinner: "Moi moi" },
      { day: "Wednesday", person: "Olayinka", breakfast: "Rice & Beans", dinner: "Amala" },
      { day: "Thursday", person: "Chidera", breakfast: "Rice & Stew", dinner: "Stew Spaghetti" },
      { day: "Friday", person: "Mimi", breakfast: "Jollof Spag", dinner: "Beans" },
      { day: "Saturday", person: "Christopher", breakfast: "Rice & Stew", dinner: "Eba" }
    ]
  }
};

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Read from Supabase REST API (Ultra fast cold starts)
async function loadRostersData() {
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
      console.error("Fast fetch failed:", e);
    }
  }
  return { rosters: DEFAULT_ROSTERS, lastUpdated: new Date().toISOString() };
}

// Save to Supabase REST API
async function saveRostersData(rostersData) {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const res = await fetchIPv4(`${SUPABASE_URL}/rest/v1/rosters_data?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ data: rostersData, updated_at: new Date().toISOString() })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase PATCH failed: ${res.status} ${errText}`);
    }
  } else {
    throw new Error("Supabase environment variables are missing on Vercel.");
  }
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', err => reject(err));
  });
}

module.exports = async (req, res) => {
  // CORS and Cache control to prevent browsers from caching stale resets
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-auth-password, x-action');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET: Fetch Rosters
  if (req.method === 'GET') {
    const data = await loadRostersData();
    res.status(200).json(data);
    return;
  }

  // POST: Save Edits
  if (req.method === 'POST') {
    try {
      const password = req.headers['x-auth-password'] || '';
      const actionHeader = req.headers['x-action'] || '';
      const inputHash = sha256(password);
      
      let authLevel = null;
      if (inputHash === HASHES.master) {
        authLevel = 'master';
      } else if (inputHash === HASHES.prayer_coordinator) {
        authLevel = 'prayer_coordinator';
      }

      if (!authLevel) {
        return res.status(401).json({ error: "Unauthorized access. Invalid password." });
      }

      // Check for Reset Action
      if (actionHeader === 'reset') {
        if (authLevel !== 'master') {
          return res.status(403).json({ error: "Forbidden. Only Master Admin can reset schedules." });
        }
        const resetData = {
          rosters: DEFAULT_ROSTERS,
          lastUpdated: new Date().toISOString()
        };
        await saveRostersData(resetData);
        return res.status(200).json({ success: true, message: "Rosters reset to defaults successfully." });
      }

      // Standard Save Action
      let newPayload;
      if (req.body && typeof req.body === 'object') {
        newPayload = req.body;
      } else {
        const body = await getRequestBody(req);
        newPayload = JSON.parse(body);
      }
      
      const fileData = await loadRostersData();
      let newRosters = fileData.rosters || {};
      
      if (authLevel === 'master') {
        newRosters = newPayload;
      } else if (authLevel === 'prayer_coordinator') {
        newRosters.prayer_roster = newPayload.prayer_roster;
      }

      fileData.rosters = newRosters;
      fileData.lastUpdated = new Date().toISOString();
      await saveRostersData(fileData);

      return res.status(200).json({ success: true, message: "Roster saved successfully.", authLevel });
    } catch (e) {
      console.error("API Error: ", e);
      return res.status(500).json({ error: `Server failed to process your save request: ${e.message}` });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
