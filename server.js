// NCCF Roster Web App - Node.js Backend Server
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = __dirname;
const DATA_DIR = fs.existsSync('/data') ? '/data' : PUBLIC_DIR;
const DATA_FILE = path.join(DATA_DIR, 'rosters.json');

// SHA-256 hashes for credentials
const HASHES = {
  master: "9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a", // nccfadmin
  prayer_coordinator: "559cbfb727a428db14c17b3a925c201ac283e3800b3e034f55153077d8d56e29" // nccfprayer
};

// Placeholder Roster Defaults - structured with Day above, Time on far left
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

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

// Compute SHA-256 Hex Hash
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Read body stream from request
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', err => reject(err));
  });
}

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

// Read or initialize rosters data (JSONBin.io or local file fallback)
async function loadRostersData() {
  if (JSONBIN_BIN_ID && JSONBIN_API_KEY) {
    try {
      console.log("Fetching rosters from JSONBin.io cloud database...");
      const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
        method: "GET",
        headers: {
          "X-Master-Key": JSONBIN_API_KEY,
          "X-Bin-Meta": "false"
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.rosters) {
          return data;
        }
      }
      console.warn("JSONBin fetch failed, falling back to local file.");
    } catch (e) {
      console.error("Failed to connect to JSONBin.io:", e);
    }
  }

  // Local File Fallback
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error("Error reading rosters.json fallback, resetting to defaults...", e);
    }
  }
  
  // Write default config to local file
  const initialData = {
    rosters: DEFAULT_ROSTERS,
    lastUpdated: new Date().toISOString()
  };
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  } catch (err) {}
  return initialData;
}

// Save rosters back to file and JSONBin.io
async function saveRostersData(rostersData) {
  if (JSONBIN_BIN_ID && JSONBIN_API_KEY) {
    try {
      console.log("Updating rosters on JSONBin.io cloud database...");
      const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
        method: "PUT",
        headers: {
          "X-Master-Key": JSONBIN_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(rostersData)
      });
      if (res.ok) {
        console.log("JSONBin.io update succeeded!");
      } else {
        console.warn("JSONBin.io update failed with status:", res.status);
      }
    } catch (e) {
      console.error("Failed to update JSONBin.io:", e);
    }
  }

  // Always write locally too as redundancy/backup
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(rostersData, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to write fallback rosters.json file:", err);
  }
}

// HTTP Server Listener
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // API ROUTE: GET /api/rosters
  if (pathname === '/api/rosters' && req.method === 'GET') {
    const data = await loadRostersData();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify(data));
  }

  // API ROUTE: POST /api/rosters (Save Edits)
  if (pathname === '/api/rosters' && req.method === 'POST') {
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
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "Unauthorized access. Invalid password." }));
      }

      // Check for Reset Action
      if (actionHeader === 'reset') {
        if (authLevel !== 'master') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: "Forbidden. Only Master Admin can reset schedules." }));
        }
        const resetData = {
          rosters: DEFAULT_ROSTERS,
          lastUpdated: new Date().toISOString()
        };
        await saveRostersData(resetData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: "Rosters reset to defaults successfully." }));
      }

      // Standard Save Action
      const body = await getRequestBody(req);
      const newPayload = JSON.parse(body);
      
      const fileData = await loadRostersData();
      
      if (authLevel === 'master') {
        fileData.rosters = newPayload;
      } else if (authLevel === 'prayer_coordinator') {
        fileData.rosters.prayer_roster = newPayload.prayer_roster;
      }

      fileData.lastUpdated = new Date().toISOString();
      saveRostersToFile(fileData);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: "Roster saved successfully.", authLevel }));
    } catch (e) {
      console.error("API Error: ", e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: "Server failed to process your save request." }));
    }
  }

  // STATIC ASSET SERVING
  let requestPath = decodeURIComponent(pathname);
  let filePath = path.join(PUBLIC_DIR, requestPath === '/' ? 'index.html' : requestPath);
  
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Internal Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  NCCF Schedule Roster backend running!`);
  console.log(`  Access dashboard: http://localhost:${PORT}/`);
  console.log(`  Edits are saved directly into: rosters.json`);
  console.log(`====================================================`);
});
