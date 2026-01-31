'use client';

import { useState, useEffect, useCallback } from 'react';

// Detect if running inside Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

interface TestEntry {
  id: number;
  value: string;
  created_at: number;
}

interface HealthData {
  status: string;
  uptime: number;
  dbPath: string;
  pid: number;
}

/**
 * Proof of Concept page for Tauri + Node.js sidecar integration.
 * Tests HTTP communication, SQLite CRUD, and SSE events.
 */
export default function PoCPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [newValue, setNewValue] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const SIDECAR_URL = 'http://127.0.0.1:3456';

  // Fetch helper (works in both Tauri and browser)
  const fetchSidecar = useCallback(async (endpoint: string, options?: RequestInit) => {
    if (isTauri) {
      // Use Tauri invoke for communication
      const { invoke } = await import('@tauri-apps/api/core');
      const method = options?.method || 'GET';
      if (method === 'GET') {
        const result = await invoke<string>('sidecar_get', { endpoint });
        return JSON.parse(result);
      } else {
        const result = await invoke<string>('sidecar_post', {
          endpoint,
          body: options?.body || '{}',
        });
        return JSON.parse(result);
      }
    } else {
      // Direct HTTP for browser testing
      const resp = await fetch(`${SIDECAR_URL}${endpoint}`, options);
      return resp.json();
    }
  }, []);

  // Check health
  const checkHealth = useCallback(async () => {
    try {
      const start = performance.now();
      const data = await fetchSidecar('/health');
      const ms = Math.round(performance.now() - start);
      setLatency(ms);
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(`Health check failed: ${err}`);
      setHealth(null);
    }
  }, [fetchSidecar]);

  // Load entries
  const loadEntries = useCallback(async () => {
    try {
      const data = await fetchSidecar('/api/entries');
      setEntries(data);
    } catch (err) {
      setError(`Load entries failed: ${err}`);
    }
  }, [fetchSidecar]);

  // Create entry
  const createEntry = async () => {
    if (!newValue.trim()) return;
    setLoading(true);
    try {
      await fetchSidecar('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue }),
      });
      setNewValue('');
      await loadEntries();
    } catch (err) {
      setError(`Create entry failed: ${err}`);
    }
    setLoading(false);
  };

  // Delete entry
  const deleteEntry = async (id: number) => {
    try {
      await fetchSidecar(`/api/entries/${id}`, { method: 'DELETE' });
      await loadEntries();
    } catch (err) {
      setError(`Delete failed: ${err}`);
    }
  };

  // Connect to SSE events
  useEffect(() => {
    const source = new EventSource(`${SIDECAR_URL}/api/events`);

    source.onmessage = (event) => {
      setEvents((prev) => [...prev.slice(-9), event.data]);
    };

    source.onerror = () => {
      setEvents((prev) => [...prev, 'SSE connection error']);
    };

    return () => source.close();
  }, []);

  // Initial load
  useEffect(() => {
    checkHealth();
    loadEntries();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [checkHealth, loadEntries]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-2">🚀 Tauri + Sidecar PoC</h1>
      <p className="text-gray-400 mb-6">
        Runtime: {isTauri ? '🟢 Tauri Desktop' : '🌐 Browser (Direct HTTP)'}
      </p>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4">
          <p className="text-red-300 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-400 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Health Status */}
      <section className="mb-6 bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-3">Health Check</h2>
        {health ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Status" value={health.status} color="green" />
            <Stat label="Uptime" value={`${health.uptime}s`} />
            <Stat label="Latency" value={latency ? `${latency}ms` : '-'} />
            <Stat label="PID" value={String(health.pid)} />
          </div>
        ) : (
          <p className="text-yellow-400">⏳ Waiting for sidecar...</p>
        )}
      </section>

      {/* CRUD Test */}
      <section className="mb-6 bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-3">SQLite CRUD Test</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createEntry()}
            placeholder="Enter test value..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button
            onClick={createEntry}
            disabled={loading || !newValue.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm font-medium"
          >
            {loading ? '...' : 'Add'}
          </button>
          <button
            onClick={loadEntries}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Refresh
          </button>
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-gray-500 text-sm">No entries yet</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between bg-gray-800 rounded px-3 py-2"
              >
                <span className="text-sm">
                  <span className="text-gray-500 mr-2">#{entry.id}</span>
                  {entry.value}
                </span>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
        <p className="text-gray-500 text-xs mt-2">{entries.length} entries</p>
      </section>

      {/* SSE Events */}
      <section className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h2 className="text-lg font-semibold mb-3">SSE Events Stream</h2>
        <div className="bg-gray-950 rounded p-3 font-mono text-xs max-h-40 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-gray-500">Waiting for events...</p>
          ) : (
            events.map((evt, i) => (
              <div key={i} className="text-green-400">
                {evt}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  const colorClass = color === 'green' ? 'text-green-400' : 'text-white';
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className={`text-sm font-medium ${colorClass}`}>{value}</p>
    </div>
  );
}
