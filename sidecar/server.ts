import http from 'node:http';
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

// --- Config ---
const PORT = 3456;
const startTime = Date.now();

// --- Database ---
const dataDir = join(homedir(), '.claude-ws');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'poc-test.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create test table
db.exec(`
  CREATE TABLE IF NOT EXISTS test_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    value TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  )
`);

// --- Helpers ---
function jsonResponse(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:8556',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// --- Routes ---
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': 'http://localhost:8556',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    // Health check
    if (url === '/health' && method === 'GET') {
      return jsonResponse(res, {
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        dbPath,
        pid: process.pid,
      });
    }

    // List entries
    if (url === '/api/entries' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM test_entries ORDER BY id DESC LIMIT 50').all();
      return jsonResponse(res, rows);
    }

    // Create entry
    if (url === '/api/entries' && method === 'POST') {
      const body = await readBody(req);
      const { value } = JSON.parse(body);
      if (!value) return jsonResponse(res, { error: 'value required' }, 400);

      const result = db.prepare('INSERT INTO test_entries (value) VALUES (?)').run(value);
      return jsonResponse(res, { id: result.lastInsertRowid, value }, 201);
    }

    // Delete entry
    if (url.startsWith('/api/entries/') && method === 'DELETE') {
      const id = url.split('/').pop();
      db.prepare('DELETE FROM test_entries WHERE id = ?').run(id);
      return jsonResponse(res, { deleted: true });
    }

    // SSE events stream (for real-time PoC)
    if (url === '/api/events' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': 'http://localhost:8556',
      });

      // Send heartbeat every 2s
      const interval = setInterval(() => {
        const data = JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now(),
          uptime: Math.floor((Date.now() - startTime) / 1000),
        });
        res.write(`data: ${data}\n\n`);
      }, 2000);

      req.on('close', () => clearInterval(interval));
      return;
    }

    // 404
    jsonResponse(res, { error: 'Not found' }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    jsonResponse(res, { error: message }, 500);
  }
}

// --- Server ---
const server = http.createServer(handleRequest);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Sidecar] Running on http://127.0.0.1:${PORT}`);
  console.log(`[Sidecar] Database: ${dbPath}`);
  console.log(`[Sidecar] PID: ${process.pid}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Sidecar] SIGTERM received, shutting down...');
  db.close();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[Sidecar] SIGINT received, shutting down...');
  db.close();
  server.close(() => process.exit(0));
});
