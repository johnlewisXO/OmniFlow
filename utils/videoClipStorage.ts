// Persistent IndexedDB Blob Storage for Async Video Clips
// Ensures recorded WebM/MP4 video blobs survive page reloads and can be played back reliably across the platform.

const DB_NAME = 'pm_async_clips_db';
const STORE_NAME = 'clip_blobs';
const DB_VERSION = 1;

function openClipsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveClipBlob(clipId: string, blob: Blob): Promise<void> {
  try {
    const db = await openClipsDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, clipId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (err) {
    console.warn('[videoClipStorage] Failed to save clip blob:', err);
  }
}

export async function getClipBlob(clipId: string): Promise<Blob | null> {
  try {
    const db = await openClipsDB();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(clipId);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob;
  } catch (err) {
    console.warn('[videoClipStorage] Failed to read clip blob:', err);
    return null;
  }
}

export async function deleteClipBlob(clipId: string): Promise<void> {
  try {
    const db = await openClipsDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(clipId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (err) {
    console.warn('[videoClipStorage] Failed to delete clip blob:', err);
  }
}

export async function getClipStorageStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const db = await openClipsDB();
    const stats = await new Promise<{ count: number; totalBytes: number }>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const blobs = (req.result as Blob[]) || [];
        const totalBytes = blobs.reduce((acc, b) => acc + (b?.size || 0), 0);
        resolve({ count: blobs.length, totalBytes });
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return stats;
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}
