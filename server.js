const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'weeks.json');
const WEB_DIR = path.join(__dirname, 'web');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readEntries() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const items = JSON.parse(raw);
  return items.sort((a, b) => b.week_start.localeCompare(a.week_start));
}

function writeEntries(entries) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function validateWeekStart(weekStart) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return false;
  const d = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCDay() === 1;
}

function computeStats(entries) {
  const recent = entries.slice(0, 6);
  const total = recent.reduce((sum, e) => sum + Number(e.hours), 0);
  const average = recent.length ? Number((total / recent.length).toFixed(2)) : 0;
  return {
    period_weeks: recent.length,
    max_period: 6,
    average_hours: average,
    limit_hours: 20,
    within_limit: average <= 20,
    weeks: recent,
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload zu groß'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Ungültiges JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, filePath) {
  const resolved = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(WEB_DIR, resolved);
  if (!fullPath.startsWith(WEB_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    sendText(res, 404, 'Not found');
    return;
  }

  const ext = path.extname(fullPath);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };

  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(fullPath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    serveStatic(res, 'index.html');
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/static/')) {
    serveStatic(res, url.pathname.replace('/static/', 'static/'));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/weeks') {
    sendJson(res, 200, readEntries());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/stats') {
    sendJson(res, 200, computeStats(readEntries()));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/weeks') {
    try {
      const body = await parseBody(req);
      const weekStart = String(body.week_start || '');
      const hours = Number(body.hours);
      const note = body.note ? String(body.note).slice(0, 200) : null;

      if (!validateWeekStart(weekStart)) {
        sendJson(res, 400, { detail: 'week_start muss ein Montag im Format YYYY-MM-DD sein.' });
        return;
      }

      if (!Number.isFinite(hours) || hours < 0 || hours > 60) {
        sendJson(res, 400, { detail: 'hours muss zwischen 0 und 60 liegen.' });
        return;
      }

      const entries = readEntries();
      const existing = entries.find((entry) => entry.week_start === weekStart);

      if (existing) {
        existing.hours = hours;
        existing.note = note;
      } else {
        const maxId = entries.reduce((max, e) => Math.max(max, e.id), 0);
        entries.push({ id: maxId + 1, week_start: weekStart, hours, note });
      }

      const sorted = entries.sort((a, b) => b.week_start.localeCompare(a.week_start));
      writeEntries(sorted);

      const saved = sorted.find((entry) => entry.week_start === weekStart);
      sendJson(res, 200, saved);
    } catch (error) {
      sendJson(res, 400, { detail: error.message || 'Ungültige Anfrage' });
    }
    return;
  }

  if (req.method === 'DELETE' && /^\/api\/weeks\/\d+$/.test(url.pathname)) {
    const id = Number(url.pathname.split('/').pop());
    const entries = readEntries();
    const nextEntries = entries.filter((entry) => entry.id !== id);

    if (nextEntries.length === entries.length) {
      sendJson(res, 404, { detail: 'Eintrag nicht gefunden.' });
      return;
    }

    writeEntries(nextEntries);
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  sendText(res, 404, 'Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  ensureDataFile();
  console.log(`Server läuft auf http://0.0.0.0:${PORT}`);
});
