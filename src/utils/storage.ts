import type { PlaylistConfig } from '../types';

const DATABASE_NAME = 'bili-randomizer';
const DATABASE_VERSION = 1;
const STORE_NAME = 'app-data';
const PLAYLIST_CACHE_KEY = 'playlists';
let playlistWriteQueue: Promise<void> = Promise.resolve();

export function readJsonStorage<T>(
  key: string,
  fallback: T,
  isValid?: (value: unknown) => value is T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (isValid && !isValid(parsed)) {
      localStorage.removeItem(key);
      return fallback;
    }
    return parsed as T;
  } catch (error) {
    console.warn(`Ignoring invalid local data for ${key}:`, error);
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in restricted environments.
    }
    return fallback;
  }
}

export function hasStorageValue(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function removeStorageValue(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage; the app can continue with in-memory state.
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
  });
}

export async function loadPlaylistCache(): Promise<PlaylistConfig[] | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(PLAYLIST_CACHE_KEY);
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : null);
      request.onerror = () => reject(request.error || new Error('Unable to read playlist cache'));
    });
  } finally {
    database.close();
  }
}

async function writePlaylistCache(playlists: PlaylistConfig[]): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(playlists, PLAYLIST_CACHE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save playlist cache'));
      transaction.onabort = () => reject(transaction.error || new Error('Playlist cache write was aborted'));
    });
  } finally {
    database.close();
  }
}

export function savePlaylistCache(playlists: PlaylistConfig[]): Promise<void> {
  const snapshot = structuredClone(playlists);
  playlistWriteQueue = playlistWriteQueue
    .catch(() => undefined)
    .then(() => writePlaylistCache(snapshot));
  return playlistWriteQueue;
}
