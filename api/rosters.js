const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
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
      { day: "Friday", time: "08:30 PM – 09:30 PM", event: "Discussion Night", person: "Ola" },
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
      { day: "Sunday", time: "09:00 AM – 09:15 AM", event: "Opening Prayer", person: "Prince" },
      { day: "Sunday", time: "09:15 AM – 09:45 AM", event: "Praise & Worship", person: "Ola" },
      { day: "Sunday", time: "09:45 AM – 10:00 AM", event: "Testimonies", person: "Oluchi" },
      { day: "Sunday", time: "10:00 AM – 10:45 AM", event: "Word Ministration", person: "Ofonime" },
      { day: "Sunday", time: "10:45 AM – 11:00 AM", event: "Offering & Tithes", person: "Judith" },
      { day: "Sunday", time: "11:00 AM – 11:10 AM", event: "Announcements", person: "Christopher" },
      { day: "Sunday", time: "11:10 AM – 11:15 AM", event: "Benediction", person: "Segun" }
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
      { day: "Sunday", person: "Judith" },
      { day: "Monday", person: "Segun" },
      { day: "Tuesday", person: "Ofonime" },
      { day: "Wednesday", person: "Christopher" },
      { day: "Thursday", person: "Chidera" },
      { day: "Friday", person: "Opeyemi" },
      { day: "Saturday", person: "Mimi" }
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
      { key: "breakfast", label: "Breakfast", editable: true },
      { key: "dinner", label: "Dinner", editable: true }
    ],
    rows: [
      { day: "Sunday", person: "Judith", breakfast: "Jollof Rice", dinner: "Spag Jollof" },
      { day: "Monday", person: "Opeyemi", breakfast: "Rice & Stew", dinner: "Eba" },
      { day: "Tuesday", person: "Ofonime", breakfast: "Fasting (till evening)", dinner: "Moimoi / Beans" },
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

// Read or initialize rosters data
async function loadRostersData() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('rosters_data')
        .select('data')
        .eq('id', 1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data && data.data) return data.data;
    } catch (e) {
      console.error("Failed to connect to Supabase:", e);
    }
  }
  return {}; // Return empty if db fails, shouldn't happen in production
}

// Save rosters back to Supabase
async function saveRostersData(rostersData) {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('rosters_data')
        .upsert({ id: 1, data: rostersData, updated_at: new Date().toISOString() });
      if (error) console.warn("Supabase update failed:", error);
    } catch (e) {
      console.error("Failed to update Supabase:", e);
    }
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
  // CORS Headers for local development if needed
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-auth-password, x-action');

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
      const body = await getRequestBody(req);
      const newPayload = JSON.parse(body);
      
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
      return res.status(500).json({ error: "Server failed to process your save request." });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
