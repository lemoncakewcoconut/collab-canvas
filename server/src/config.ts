import fs from 'node:fs';
import path from 'node:path';

export const PORT = parseInt(process.env.PORT || '8080', 10);
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
export const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '25', 10);
export const UPLOAD_CHUNK_MB = parseInt(process.env.UPLOAD_CHUNK_MB || '1', 10);

export const ROOMS_DIR = path.join(DATA_DIR, 'rooms');
export const ASSETS_DIR = path.join(DATA_DIR, 'assets');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const SECRET_FILE = path.join(DATA_DIR, 'server-secret');

// Ensure required data storage directories exist
export function initDirectories(): void {
  for (const dir of [DATA_DIR, ROOMS_DIR, ASSETS_DIR, UPLOADS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
