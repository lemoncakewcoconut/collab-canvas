import fs from 'node:fs';
import path from 'node:path';
import * as Y from 'yjs';
import {
  HISTORY_SNAPSHOT_INTERVAL_MS,
  MAX_HISTORY_SNAPSHOTS,
  YDOC_DEBOUNCE_SAVE_MS,
} from '@collabcanvas/shared';
import { ROOMS_DIR } from './config.js';
import { hashPassword } from './security.js';

export interface StoredRoomMeta {
  id: string;
  title: string;
  createdAt: number;
  passwordHash?: string;
  passwordSalt?: string;
}

export interface SnapshotMeta {
  timestamp: number;
  version: number;
  sizeBytes: number;
  fileName: string;
}

const activeDebounceTimers = new Map<string, NodeJS.Timeout>();
const activeHistoryIntervals = new Map<string, NodeJS.Timeout>();
const lastSavedHash = new Map<string, number>();

export function getRoomMetaPath(roomId: string): string {
  return path.join(ROOMS_DIR, `${roomId}.meta.json`);
}

export function getRoomDocPath(roomId: string): string {
  return path.join(ROOMS_DIR, `${roomId}.ydoc`);
}

export function getRoomHistoryDir(roomId: string): string {
  return path.join(ROOMS_DIR, roomId, 'history');
}

/**
 * List all rooms metadata (without passwords)
 */
export function listRooms(): Array<{
  id: string;
  title: string;
  createdAt: number;
  hasPassword: boolean;
}> {
  if (!fs.existsSync(ROOMS_DIR)) return [];
  const files = fs.readdirSync(ROOMS_DIR);
  const rooms = [];

  for (const file of files) {
    if (file.endsWith('.meta.json')) {
      const roomId = file.replace('.meta.json', '');
      const meta = getRoomMeta(roomId);
      if (meta) {
        rooms.push({
          id: meta.id,
          title: meta.title,
          createdAt: meta.createdAt,
          hasPassword: Boolean(meta.passwordHash),
        });
      }
    }
  }

  return rooms.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get room metadata
 */
export function getRoomMeta(roomId: string): StoredRoomMeta | null {
  const filePath = getRoomMetaPath(roomId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as StoredRoomMeta;
  } catch {
    return null;
  }
}

/**
 * Create or save room metadata
 */
export async function createOrUpdateRoom(
  id: string,
  title?: string,
  password?: string
): Promise<StoredRoomMeta> {
  const existing = getRoomMeta(id);
  const meta: StoredRoomMeta = existing || {
    id,
    title: title || `Room ${id.slice(0, 6)}`,
    createdAt: Date.now(),
  };

  if (title) meta.title = title;

  if (password) {
    const { salt, hash } = await hashPassword(password);
    meta.passwordSalt = salt;
    meta.passwordHash = hash;
  }

  fs.writeFileSync(getRoomMetaPath(id), JSON.stringify(meta, null, 2), 'utf-8');
  return meta;
}

/**
 * Loads Y.Doc binary snapshot from disk if present
 */
export function loadRoomDoc(doc: Y.Doc, roomId: string): boolean {
  const docPath = getRoomDocPath(roomId);
  if (fs.existsSync(docPath)) {
    try {
      const buffer = fs.readFileSync(docPath);
      Y.applyUpdate(doc, new Uint8Array(buffer));
      return true;
    } catch (err) {
      console.error(`Failed to load YDoc for room ${roomId}:`, err);
    }
  }
  return false;
}

/**
 * Immediately persist Y.Doc binary snapshot to disk
 */
export function persistRoomDocSync(doc: Y.Doc, roomId: string): void {
  try {
    const docPath = getRoomDocPath(roomId);
    const update = Y.encodeStateAsUpdate(doc);
    fs.writeFileSync(docPath, Buffer.from(update));
  } catch (err) {
    console.error(`Failed to persist YDoc for room ${roomId}:`, err);
  }
}

/**
 * Debounced Y.Doc persistence to disk (2 seconds delay)
 */
export function scheduleRoomDocSave(doc: Y.Doc, roomId: string): void {
  const existingTimer = activeDebounceTimers.get(roomId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    persistRoomDocSync(doc, roomId);
    activeDebounceTimers.delete(roomId);
  }, YDOC_DEBOUNCE_SAVE_MS);

  activeDebounceTimers.set(roomId, timer);
}

/**
 * Creates a historical snapshot of room state (up to 50 versions retained)
 */
export function createRoomSnapshot(doc: Y.Doc, roomId: string): SnapshotMeta | null {
  try {
    const historyDir = getRoomHistoryDir(roomId);
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }

    const timestamp = Date.now();
    const update = Y.encodeStateAsUpdate(doc);
    const fileName = `${timestamp}.ydoc`;
    const snapshotPath = path.join(historyDir, fileName);

    fs.writeFileSync(snapshotPath, Buffer.from(update));

    // Prune old snapshots exceeding MAX_HISTORY_SNAPSHOTS
    const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.ydoc'));
    if (files.length > MAX_HISTORY_SNAPSHOTS) {
      files.sort();
      const toDelete = files.slice(0, files.length - MAX_HISTORY_SNAPSHOTS);
      for (const delFile of toDelete) {
        fs.unlinkSync(path.join(historyDir, delFile));
      }
    }

    return {
      timestamp,
      version: files.length,
      sizeBytes: update.byteLength,
      fileName,
    };
  } catch (err) {
    console.error(`Failed to create snapshot for room ${roomId}:`, err);
    return null;
  }
}

/**
 * Start periodic snapshot interval (every 10 minutes)
 */
export function startSnapshotInterval(doc: Y.Doc, roomId: string): void {
  if (activeHistoryIntervals.has(roomId)) return;

  const interval = setInterval(() => {
    createRoomSnapshot(doc, roomId);
  }, HISTORY_SNAPSHOT_INTERVAL_MS);

  activeHistoryIntervals.set(roomId, interval);
}

export function stopSnapshotInterval(roomId: string): void {
  const interval = activeHistoryIntervals.get(roomId);
  if (interval) {
    clearInterval(interval);
    activeHistoryIntervals.delete(roomId);
  }
}

/**
 * List history snapshots for a room
 */
export function listRoomSnapshots(roomId: string): SnapshotMeta[] {
  const historyDir = getRoomHistoryDir(roomId);
  if (!fs.existsSync(historyDir)) return [];

  const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.ydoc'));
  return files.map((file, idx) => {
    const filePath = path.join(historyDir, file);
    const stat = fs.statSync(filePath);
    const timestamp = parseInt(file.replace('.ydoc', ''), 10);
    return {
      timestamp: isNaN(timestamp) ? stat.mtimeMs : timestamp,
      version: idx + 1,
      sizeBytes: stat.size,
      fileName: file,
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Restore a historical snapshot to the active room Y.Doc
 */
export function restoreRoomSnapshot(
  doc: Y.Doc,
  roomId: string,
  snapshotTimestamp: number
): boolean {
  const historyDir = getRoomHistoryDir(roomId);
  const snapshotPath = path.join(historyDir, `${snapshotTimestamp}.ydoc`);

  if (!fs.existsSync(snapshotPath)) return false;

  try {
    const buffer = fs.readFileSync(snapshotPath);
    // Clear current root map elements and re-apply update
    Y.applyUpdate(doc, new Uint8Array(buffer));
    persistRoomDocSync(doc, roomId);
    return true;
  } catch (err) {
    console.error(`Failed to restore snapshot ${snapshotTimestamp} for room ${roomId}:`, err);
    return false;
  }
}
