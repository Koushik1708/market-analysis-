/**
 * stockCacheService.ts
 *
 * Provides IndexedDB-backed caching for large stock API payloads.
 * - Large datasets are stored in IndexedDB (db: "stock-cache", store: "stocks")
 * - Lightweight metadata { ticker, years, timestamp } is stored in localStorage
 * - Auto-evicts oldest entries when more than MAX_CACHE_ENTRIES are stored
 * - All operations are wrapped in try/catch; if IndexedDB is unavailable the
 *   app simply skips caching and continues to function normally.
 */

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'stock-cache';
const STORE_NAME = 'stocks';
const DB_VERSION = 1;
const MAX_CACHE_ENTRIES = 10;
const LS_META_KEY = 'stock_cache_metadata';

interface CacheMetaEntry {
  key: string;       // "{ticker}_{years}"
  ticker: string;
  years: number;
  timestamp: number; // ms since epoch
}

// ─── Internal helpers ────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    }).catch(() => {
      dbPromise = null; // reset so next call retries
      return null as unknown as IDBPDatabase;
    });
  }
  return dbPromise;
}

function makeKey(ticker: string, years: number): string {
  return `${ticker}_${years}`;
}

// Read metadata array from localStorage (never throws)
function readMeta(): CacheMetaEntry[] {
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CacheMetaEntry[];
  } catch {
    return [];
  }
}

// Persist metadata array to localStorage (never throws)
function writeMeta(entries: CacheMetaEntry[]): void {
  try {
    localStorage.setItem(LS_META_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded even for tiny metadata — just skip
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load a cached payload from IndexedDB.
 * Returns null if not found or if IndexedDB is unavailable.
 */
export async function loadFromCache(ticker: string, years: number): Promise<any | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const key = makeKey(ticker, years);
    const value = await db.get(STORE_NAME, key);
    return value ?? null;
  } catch {
    return null;
  }
}

/**
 * Save a payload to IndexedDB and write lightweight metadata to localStorage.
 * Automatically evicts the oldest entries if more than MAX_CACHE_ENTRIES exist.
 * Returns true on success, false if caching was skipped.
 */
export async function saveToCache(ticker: string, years: number, payload: any): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    const key = makeKey(ticker, years);

    // Write the large payload to IndexedDB
    await db.put(STORE_NAME, payload, key);

    // Update lightweight metadata in localStorage
    let meta = readMeta().filter(e => e.key !== key); // remove old entry for same key
    meta.push({ key, ticker, years, timestamp: Date.now() });

    // Auto-evict oldest entries if over limit
    if (meta.length > MAX_CACHE_ENTRIES) {
      // Sort oldest first
      meta.sort((a, b) => a.timestamp - b.timestamp);
      const toEvict = meta.splice(0, meta.length - MAX_CACHE_ENTRIES);
      for (const entry of toEvict) {
        try {
          await db.delete(STORE_NAME, entry.key);
        } catch {
          // Best-effort eviction
        }
      }
    }

    writeMeta(meta);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all cached stock data from both IndexedDB and localStorage metadata.
 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await getDb();
    if (db) {
      await db.clear(STORE_NAME);
    }
  } catch {
    // Ignore
  }
  try {
    localStorage.removeItem(LS_META_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Returns the current cache metadata entries (for debugging/display).
 */
export function getCacheMetadata(): CacheMetaEntry[] {
  return readMeta();
}
