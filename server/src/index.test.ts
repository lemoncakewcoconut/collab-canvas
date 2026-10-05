import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as Y from 'yjs';
import {
  hashPassword,
  verifyPassword,
  generateRoomToken,
  verifyRoomToken,
} from './security.js';
import {
  initUploadSession,
  saveUploadPart,
  getUploadStatus,
  completeUpload,
  getAssetPath,
} from './uploads.js';
import {
  createOrUpdateRoom,
  getRoomMeta,
  persistRoomDocSync,
  loadRoomDoc,
  createRoomSnapshot,
  listRoomSnapshots,
} from './storage.js';
import { initDirectories, DATA_DIR } from './config.js';

test('Backend Setup: initializes storage directories', () => {
  initDirectories();
  assert.ok(fs.existsSync(DATA_DIR));
});

test('Security: scrypt password hashing and verification', async () => {
  const password = 'SuperSecretRoomPassword123!';
  const { salt, hash } = await hashPassword(password);

  assert.ok(salt.length > 0);
  assert.ok(hash.length > 0);

  const isValid = await verifyPassword(password, salt, hash);
  assert.strictEqual(isValid, true);

  const isInvalid = await verifyPassword('WrongPassword', salt, hash);
  assert.strictEqual(isInvalid, false);
});

test('Security: HMAC room tokens issue and verify', () => {
  const roomId = 'room-alpha-1';
  const token = generateRoomToken(roomId);
  assert.ok(token.length > 0);

  assert.strictEqual(verifyRoomToken(roomId, token), true);
  assert.strictEqual(verifyRoomToken('different-room', token), false);
  assert.strictEqual(verifyRoomToken(roomId, 'tampered-token'), false);
});

test('Uploads: Resumable chunked upload, assembly and sha256 verification', async () => {
  const nonce = `test-${Date.now()}-${Math.random()}`;
  const part1 = Buffer.from(`Hello, this is part 1 of ${nonce}! `);
  const part2 = Buffer.from('And this is part 2 of the uploaded file.');
  const fullContent = Buffer.concat([part1, part2]);
  const expectedHash = crypto.createHash('sha256').update(fullContent).digest('hex');

  // 1. Initialize fresh upload session
  const init = initUploadSession('test-doc.txt', fullContent.length, 'text/plain', expectedHash);
  assert.ok(init.uploadId.length > 0);
  assert.strictEqual(init.totalChunks, 1); // since fullContent < 1MB, totalChunks=1
  assert.strictEqual(init.deduplicated, false);

  // Save part 0
  saveUploadPart(init.uploadId, 0, fullContent);

  // Status check
  const status = getUploadStatus(init.uploadId);
  assert.strictEqual(status.completed, true);
  assert.deepStrictEqual(status.uploadedParts, [0]);

  // Complete
  const asset = await completeUpload(init.uploadId);
  assert.strictEqual(asset.assetId, expectedHash);
  assert.strictEqual(asset.fileSize, fullContent.length);

  // Asset file on disk
  const filePath = getAssetPath(expectedHash);
  assert.ok(fs.existsSync(filePath));
  const savedData = fs.readFileSync(filePath);
  assert.strictEqual(savedData.toString('utf-8'), fullContent.toString('utf-8'));

  // Test deduplication on subsequent init with identical hash
  const dedupInit = initUploadSession('duplicate-doc.txt', fullContent.length, 'text/plain', expectedHash);
  assert.strictEqual(dedupInit.deduplicated, true);
  assert.strictEqual(dedupInit.assetId, expectedHash);
});

test('Storage & CRDT: persists and restores YDoc binary updates', () => {
  const testRoomId = 'test-persist-room';
  const docA = new Y.Doc();
  const elementsMapA = docA.getMap('elements');
  elementsMapA.set('shape-1', { id: 'shape-1', type: 'shape', color: '#ff0000' });

  // Save binary snapshot
  persistRoomDocSync(docA, testRoomId);

  // Load into docB
  const docB = new Y.Doc();
  const loaded = loadRoomDoc(docB, testRoomId);
  assert.strictEqual(loaded, true);

  const elementsMapB = docB.getMap('elements');
  const shape = elementsMapB.get('shape-1') as any;
  assert.strictEqual(shape?.color, '#ff0000');

  // Create historical snapshot
  const snapshot = createRoomSnapshot(docA, testRoomId);
  assert.ok(snapshot !== null);
  const snapshots = listRoomSnapshots(testRoomId);
  assert.ok(snapshots.length >= 1);
});
