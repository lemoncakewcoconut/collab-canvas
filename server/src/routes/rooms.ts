import { Router } from 'express';
import {
  createOrUpdateRoom,
  getRoomMeta,
  listRooms,
  listRoomSnapshots,
  restoreRoomSnapshot,
} from '../storage.js';
import { generateRoomToken, verifyPassword } from '../security.js';
import { CRDTServer } from '../crdt.js';

export function createRoomsRouter(crdtServer: CRDTServer): Router {
  const router = Router();

  // List all rooms
  router.get('/', (_req, res) => {
    try {
      const rooms = listRooms();
      res.json({ rooms });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create room
  router.post('/', async (req, res) => {
    try {
      const { id, title, password } = req.body;
      const roomId = id || `room-${Date.now().toString(36)}`;
      const meta = await createOrUpdateRoom(roomId, title, password);

      let token: string | undefined;
      if (password) {
        token = generateRoomToken(roomId);
      }

      res.status(201).json({
        room: {
          id: meta.id,
          title: meta.title,
          createdAt: meta.createdAt,
          hasPassword: Boolean(meta.passwordHash),
        },
        token,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get room info
  router.get('/:id', (req, res) => {
    const meta = getRoomMeta(req.params.id as string);
    if (!meta) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      room: {
        id: meta.id,
        title: meta.title,
        createdAt: meta.createdAt,
        hasPassword: Boolean(meta.passwordHash),
      },
    });
  });

  // Authenticate with room password
  router.post('/:id/auth', async (req, res) => {
    const meta = getRoomMeta(req.params.id as string);
    if (!meta) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!meta.passwordHash || !meta.passwordSalt) {
      // Room has no password
      const token = generateRoomToken(meta.id);
      return res.json({ success: true, token });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password required' });
    }

    const valid = await verifyPassword(password, meta.passwordSalt, meta.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Incorrect password' });
    }

    const token = generateRoomToken(meta.id);
    res.json({ success: true, token });
  });

  // Get snapshot history
  router.get('/:id/history', (req, res) => {
    try {
      const snapshots = listRoomSnapshots(req.params.id as string);
      res.json({ snapshots });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Restore snapshot
  router.post('/:id/restore', (req, res) => {
    const { timestamp } = req.body;
    if (!timestamp) {
      return res.status(400).json({ error: 'Timestamp is required' });
    }

    const roomId = req.params.id as string;
    const doc = crdtServer.getRoomDoc(roomId);
    if (!doc) {
      return res.status(400).json({ error: 'Active room document not loaded' });
    }

    const success = restoreRoomSnapshot(doc, roomId, parseInt(timestamp, 10));
    if (!success) {
      return res.status(500).json({ error: 'Failed to restore snapshot' });
    }

    res.json({ success: true });
  });

  return router;
}
