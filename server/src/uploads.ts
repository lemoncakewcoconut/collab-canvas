import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  MAX_UPLOAD_SIZE_BYTES,
  UPLOAD_CHUNK_SIZE_BYTES,
  AssetMeta,
  UploadInitResponse,
  UploadStatusResponse,
} from '@collabcanvas/shared';
import { ASSETS_DIR, UPLOADS_DIR } from './config.js';

export interface UploadSession {
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  expectedSha256?: string;
  createdAt: number;
}

export function getUploadSessionDir(uploadId: string): string {
  return path.join(UPLOADS_DIR, uploadId);
}

export function getUploadManifestPath(uploadId: string): string {
  return path.join(getUploadSessionDir(uploadId), 'manifest.json');
}

export function getPartPath(uploadId: string, partIndex: number): string {
  return path.join(getUploadSessionDir(uploadId), `${partIndex}.part`);
}

export function getAssetPath(assetId: string): string {
  return path.join(ASSETS_DIR, assetId);
}

export function getAssetMetaPath(assetId: string): string {
  return path.join(ASSETS_DIR, `${assetId}.meta.json`);
}

export function getAssetThumbnailPath(assetId: string): string {
  return path.join(ASSETS_DIR, `${assetId}.w256`);
}

/**
 * Initialize a chunked upload session, with SHA-256 deduplication check
 */
export function initUploadSession(
  fileName: string,
  fileSize: number,
  mimeType: string,
  expectedSha256?: string
): UploadInitResponse {
  if (fileSize > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`File size ${fileSize} exceeds maximum allowed size of ${MAX_UPLOAD_SIZE_BYTES} bytes`);
  }

  // Deduplication check: if file with exact sha256 already exists, skip upload
  if (expectedSha256) {
    const existingAsset = getAssetPath(expectedSha256);
    if (fs.existsSync(existingAsset)) {
      return {
        uploadId: '',
        totalChunks: 0,
        chunkSize: UPLOAD_CHUNK_SIZE_BYTES,
        deduplicated: true,
        assetId: expectedSha256,
      };
    }
  }

  const uploadId = crypto.randomUUID();
  const sessionDir = getUploadSessionDir(uploadId);
  fs.mkdirSync(sessionDir, { recursive: true });

  const totalChunks = Math.ceil(fileSize / UPLOAD_CHUNK_SIZE_BYTES);

  const session: UploadSession = {
    uploadId,
    fileName,
    fileSize,
    mimeType,
    totalChunks,
    expectedSha256,
    createdAt: Date.now(),
  };

  fs.writeFileSync(getUploadManifestPath(uploadId), JSON.stringify(session, null, 2), 'utf-8');

  return {
    uploadId,
    totalChunks,
    chunkSize: UPLOAD_CHUNK_SIZE_BYTES,
    deduplicated: false,
  };
}

/**
 * Save an individual 1 MB chunk part
 */
export function saveUploadPart(uploadId: string, partIndex: number, chunkBuffer: Buffer): void {
  const sessionDir = getUploadSessionDir(uploadId);
  if (!fs.existsSync(sessionDir)) {
    throw new Error(`Upload session ${uploadId} not found`);
  }

  const partFile = getPartPath(uploadId, partIndex);
  fs.writeFileSync(partFile, chunkBuffer);
}

/**
 * Get status of an ongoing upload (which parts are already uploaded)
 */
export function getUploadStatus(uploadId: string): UploadStatusResponse {
  const sessionDir = getUploadSessionDir(uploadId);
  const manifestPath = getUploadManifestPath(uploadId);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Upload session ${uploadId} not found`);
  }

  const session = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as UploadSession;
  const files = fs.readdirSync(sessionDir);
  const uploadedParts: number[] = [];

  for (const f of files) {
    if (f.endsWith('.part')) {
      const idx = parseInt(f.replace('.part', ''), 10);
      if (!isNaN(idx)) uploadedParts.push(idx);
    }
  }

  uploadedParts.sort((a, b) => a - b);

  return {
    uploadId,
    fileName: session.fileName,
    totalChunks: session.totalChunks,
    uploadedParts,
    completed: uploadedParts.length === session.totalChunks,
  };
}

/**
 * Assemble all parts into master asset file, verify SHA-256 and generate thumbnail
 */
export async function completeUpload(uploadId: string): Promise<AssetMeta> {
  const manifestPath = getUploadManifestPath(uploadId);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Upload session ${uploadId} not found`);
  }

  const session = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as UploadSession;
  const hash = crypto.createHash('sha256');

  // Verify all parts exist
  for (let i = 0; i < session.totalChunks; i++) {
    const partFile = getPartPath(uploadId, i);
    if (!fs.existsSync(partFile)) {
      throw new Error(`Missing part ${i} for upload ${uploadId}`);
    }
  }

  // Create temporary assembled file
  const tempAssembled = path.join(UPLOADS_DIR, `${uploadId}.assembled`);
  const writeStream = fs.createWriteStream(tempAssembled);

  for (let i = 0; i < session.totalChunks; i++) {
    const partFile = getPartPath(uploadId, i);
    const data = fs.readFileSync(partFile);
    hash.update(data);
    writeStream.write(data);
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end(() => resolve());
    writeStream.on('error', reject);
  });

  const finalSha256 = hash.digest('hex');

  // Verify expected SHA-256 if provided
  if (session.expectedSha256 && session.expectedSha256 !== finalSha256) {
    fs.unlinkSync(tempAssembled);
    throw new Error(`SHA-256 mismatch. Expected: ${session.expectedSha256}, calculated: ${finalSha256}`);
  }

  const assetPath = getAssetPath(finalSha256);
  if (!fs.existsSync(assetPath)) {
    fs.renameSync(tempAssembled, assetPath);
  } else {
    // Already exists via deduplication
    fs.unlinkSync(tempAssembled);
  }

  // Generate thumbnail if image
  let hasThumbnail = false;
  if (session.mimeType.startsWith('image/')) {
    hasThumbnail = generateImageThumbnail(assetPath, getAssetThumbnailPath(finalSha256));
  }

  const assetMeta: AssetMeta = {
    assetId: finalSha256,
    fileName: session.fileName,
    fileSize: session.fileSize,
    mimeType: session.mimeType,
    createdAt: Date.now(),
    hasThumbnail,
  };

  fs.writeFileSync(getAssetMetaPath(finalSha256), JSON.stringify(assetMeta, null, 2), 'utf-8');

  // Clean up upload parts and session folder
  try {
    fs.rmSync(getUploadSessionDir(uploadId), { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to clean up upload dir for ${uploadId}:`, err);
  }

  return assetMeta;
}

/**
 * Generate a thumbnail preview or SVG placeholder
 */
function generateImageThumbnail(sourcePath: string, targetPath: string): boolean {
  try {
    // For fast, lightweight, dependency-free thumbnail generation, we can either copy or create SVG card
    // If the file is SVG or small, we can copy directly:
    const stat = fs.statSync(sourcePath);
    if (stat.size <= 256 * 1024) {
      fs.copyFileSync(sourcePath, targetPath);
      return true;
    }
    // Otherwise copy or link as thumbnail
    fs.copyFileSync(sourcePath, targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get asset metadata
 */
export function getAssetMeta(assetId: string): AssetMeta | null {
  const metaPath = getAssetMetaPath(assetId);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as AssetMeta;
  } catch {
    return null;
  }
}
