// NCCF Roster Web App - Node.js Backend Server
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8080;
const PUBLIC_DIR = __dirname;
const DATA_FILE = path.join(PUBLIC_DIR, 'rosters.json');

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
      { day: "Monday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Bro. [Morning Lead]" },
      { day: "Monday", time: "08:30 PM – 09:00 PM", event: "Evening Devotional: Hymns", person: "Sis. [Evening Lead]" },
      
      { day: "Tuesday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Bro. [Morning Lead]" },
      { day: "Tuesday", time: "06:00 PM – 07:00 PM", event: "Fasting & Prayer Meeting", person: "Sis. [Evening Lead]" },
      
      { day: "Wednesday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Bro. [Morning Lead]" },
      { day: "Wednesday", time: "08:30 PM – 09:00 PM", event: "Theme Exposition", person: "Bro. [Evening Lead]" },
      
      { day: "Thursday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Bro. [Morning Lead]" },
      { day: "Thursday", time: "04:30 PM – 06:00 PM", event: "Bible Study", person: "Bro. [Bible Teacher]" },
      
      { day: "Friday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Sis. [Morning Lead]" },
      { day: "Friday", time: "08:30 PM – 09:30 PM", event: "Discussion Night", person: "Sis. [Evening Lead]" },
      
      { day: "Saturday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Bro. [Morning Lead]" },
      { day: "Saturday", time: "08:30 PM – 09:00 PM", event: "Praise & Worship", person: "Sis. [Choir Lead]" }
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
      { day: "Sunday", time: "09:00 AM – 09:15 AM", event: "Opening Prayer", person: "Bro. [Prayer Leader]" },
      { day: "Sunday", time: "09:15 AM – 09:45 AM", event: "Praise & Worship", person: "NCCF Choir" },
      { day: "Sunday", time: "09:45 AM – 10:00 AM", event: "Testimonies", person: "Congregation" },
      { day: "Sunday", time: "10:00 AM – 10:45 AM", event: "Word Ministration", person: "Bro. [Preacher]" },
      { day: "Sunday", time: "10:45 AM – 11:00 AM", event: "Offering & Tithes", person: "Sis. [Finance Officer]" },
      { day: "Sunday", time: "11:00 AM – 11:10 AM", event: "Announcements", person: "Bro. [Secretary]" },
      { day: "Sunday", time: "11:10 AM – 11:15 AM", event: "Benediction", person: "Bro. [President]" }
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
      { day: "Sunday", person: "Group A (Judith & Opeyemi)" },
      { day: "Monday", person: "Group B (Segun & Mimi)" },
      { day: "Tuesday", person: "Group C (Ofonime & Olayinka)" },
      { day: "Wednesday", person: "Group D (Christopher & Prince)" },
      { day: "Thursday", person: "Group E (Chidera & Judith)" },
      { day: "Friday", person: "Group A (Opeyemi & Segun)" },
      { day: "Saturday", person: "All Corpers (General Sanitation)" }
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

// Read or initialize rosters.json
function loadRostersFromFile() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error("Error reading rosters.json, resetting to defaults...", e);
    }
  }
  
  // Write default config
  const initialData = {
    rosters: DEFAULT_ROSTERS,
    lastUpdated: new Date().toISOString()
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  return initialData;
}

// Save rosters back to file
function saveRostersToFile(rostersData) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(rostersData, null, 2), 'utf-8');
}

// HTTP Server Listener
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // API ROUTE: GET /api/rosters
  if (pathname === '/api/rosters' && req.method === 'GET') {
    const data = loadRostersFromFile();
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
        saveRostersToFile(resetData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: "Rosters reset to defaults successfully." }));
      }

      // Standard Save Action
      const body = await getRequestBody(req);
      const newPayload = JSON.parse(body);
      
      const fileData = loadRostersFromFile();
      
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
