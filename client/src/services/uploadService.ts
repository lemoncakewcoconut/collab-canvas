import {
  MAX_PARALLEL_CHUNKS,
  MAX_UPLOAD_SIZE_BYTES,
  UPLOAD_CHUNK_SIZE_BYTES,
  UploadCompleteResponse,
  UploadInitResponse,
  UploadStatusResponse,
} from '@collabcanvas/shared';

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
}

/**
 * Computes SHA-256 hash using browser native Web Crypto API when available (HTTPS or localhost).
 * In non-secure contexts (e.g. HTTP over LAN IP), returns undefined and leaves hash generation to the server.
 */
export async function computeFileSha256(file: File): Promise<string | undefined> {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('Web Crypto subtle not available in this context, server will compute SHA-256:', err);
  }
  return undefined;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Resumable Chunked Upload Service
 * Handles files up to 25 MB in 1 MB chunks with parallel workers and retries.
 * Falls back safely to local Base64/DataURL if server upload endpoint encounters network error.
 */
export async function uploadFileResumable(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadCompleteResponse> {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`File ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 25 MB limit.`);
  }

  try {
    // 1. Calculate SHA-256 if supported in current browser context
    const sha256 = await computeFileSha256(file);

    // 2. Initialize upload session
    const initRes = await fetch('/api/assets/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        sha256,
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({ error: 'Upload endpoint unavailable' }));
      throw new Error(err.error || 'Failed to initialize upload session');
    }

    const initData = (await initRes.json()) as UploadInitResponse;

  // Deduplicated fast return!
  if (initData.deduplicated && initData.assetId) {
    if (onProgress) {
      onProgress({
        uploadedBytes: file.size,
        totalBytes: file.size,
        percentage: 100,
        currentChunk: initData.totalChunks,
        totalChunks: initData.totalChunks,
      });
    }
    return {
      success: true,
      assetId: initData.assetId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  }

  const uploadId = initData.uploadId;
  const totalChunks = initData.totalChunks;

  // Check already uploaded parts (for resuming)
  const statusRes = await fetch(`/api/assets/uploads/${uploadId}`);
  let uploadedParts = new Set<number>();
  if (statusRes.ok) {
    const statusData = (await statusRes.json()) as UploadStatusResponse;
    uploadedParts = new Set(statusData.uploadedParts);
  }

  const missingChunks: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!uploadedParts.has(i)) {
      missingChunks.push(i);
    }
  }

  let completedChunksCount = uploadedParts.size;

  // Helper to upload one chunk with exponential backoff
  const uploadChunk = async (chunkIndex: number): Promise<void> => {
    const start = chunkIndex * UPLOAD_CHUNK_SIZE_BYTES;
    const end = Math.min(file.size, start + UPLOAD_CHUNK_SIZE_BYTES);
    const chunkBlob = file.slice(start, end);

    let retries = 3;
    let delay = 500;

    while (retries > 0) {
      try {
        const res = await fetch(`/api/assets/uploads/${uploadId}/${chunkIndex}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: chunkBlob,
        });

        if (res.ok) {
          completedChunksCount++;
          if (onProgress) {
            const uploadedBytes = Math.min(file.size, completedChunksCount * UPLOAD_CHUNK_SIZE_BYTES);
            onProgress({
              uploadedBytes,
              totalBytes: file.size,
              percentage: Math.round((uploadedBytes / file.size) * 100),
              currentChunk: completedChunksCount,
              totalChunks,
            });
          }
          return;
        }
      } catch (err) {
        console.warn(`Retry chunk ${chunkIndex}:`, err);
      }

      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw new Error(`Failed to upload chunk ${chunkIndex} after multiple attempts`);
  };

  // Run chunk uploads in parallel batches (up to MAX_PARALLEL_CHUNKS)
  const queue = [...missingChunks];
  const workers = Array(Math.min(MAX_PARALLEL_CHUNKS, queue.length))
    .fill(null)
    .map(async () => {
      while (queue.length > 0) {
        const chunkIdx = queue.shift();
        if (chunkIdx !== undefined) {
          await uploadChunk(chunkIdx);
        }
      }
    });

  await Promise.all(workers);

  // 3. Complete and finalize asset
  const completeRes = await fetch(`/api/assets/uploads/${uploadId}/complete`, {
    method: 'POST',
  });

  if (!completeRes.ok) {
    const err = await completeRes.json();
    throw new Error(err.error || 'Failed to complete upload');
  }

  return (await completeRes.json()) as UploadCompleteResponse;
  } catch (err) {
    console.warn('Network upload failed, falling back to local inline Data URL:', err);
    const dataUrl = await readFileAsDataUrl(file);
    if (onProgress) {
      onProgress({
        uploadedBytes: file.size,
        totalBytes: file.size,
        percentage: 100,
        currentChunk: 1,
        totalChunks: 1,
      });
    }
    return {
      success: true,
      assetId: dataUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'image/png',
    };
  }
}
