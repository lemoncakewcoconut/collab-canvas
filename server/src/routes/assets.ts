import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import {
  completeUpload,
  getAssetMeta,
  getAssetPath,
  getAssetThumbnailPath,
  getUploadStatus,
  initUploadSession,
  saveUploadPart,
} from '../uploads.js';

export function createAssetsRouter(): Router {
  const router = Router();

  // 1. Initialize upload session
  router.post('/uploads', (req, res) => {
    try {
      const { fileName, fileSize, mimeType, sha256 } = req.body;
      if (!fileName || !fileSize || !mimeType) {
        return res.status(400).json({ error: 'fileName, fileSize, and mimeType are required' });
      }

      const response = initUploadSession(fileName, fileSize, mimeType, sha256);
      res.status(201).json(response);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 2. Upload chunk part (raw binary stream)
  router.put('/uploads/:uploadId/:partIndex', (req: Request, res: Response) => {
    const uploadId = req.params.uploadId as string;
    const partIndex = req.params.partIndex as string;
    const idx = parseInt(partIndex, 10);
    if (isNaN(idx) || idx < 0) {
      return res.status(400).json({ error: 'Invalid partIndex' });
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        saveUploadPart(uploadId, idx, fullBuffer);
        res.json({ partIndex: idx, received: true });
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    req.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
  });

  // 3. Query upload status for resumable uploads
  router.get('/uploads/:uploadId', (req, res) => {
    try {
      const status = getUploadStatus(req.params.uploadId as string);
      res.json(status);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // 4. Complete upload session
  router.post('/uploads/:uploadId/complete', async (req, res) => {
    try {
      const assetMeta = await completeUpload(req.params.uploadId as string);
      res.json({ success: true, ...assetMeta });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 5. Download / stream asset with HTTP Range support
  router.get('/:assetId', (req, res) => {
    const assetId = req.params.assetId as string;
    const assetPath = getAssetPath(assetId);
    if (!fs.existsSync(assetPath)) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const meta = getAssetMeta(assetId);
    const mimeType = meta?.mimeType || 'application/octet-stream';
    const stat = fs.statSync(assetPath);
    const totalSize = stat.size;

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      // Range: bytes=start-end
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(assetPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(assetPath).pipe(res);
    }
  });

  // 6. Download thumbnail
  router.get('/:assetId/thumbnail', (req, res) => {
    const assetId = req.params.assetId as string;
    const thumbPath = getAssetThumbnailPath(assetId);
    if (fs.existsSync(thumbPath)) {
      res.setHeader('Content-Type', 'image/png');
      fs.createReadStream(thumbPath).pipe(res);
    } else {
      // Fallback to original asset
      const origPath = getAssetPath(assetId);
      if (fs.existsSync(origPath)) {
        fs.createReadStream(origPath).pipe(res);
      } else {
        res.status(404).json({ error: 'Thumbnail not found' });
      }
    }
  });

  return router;
}
