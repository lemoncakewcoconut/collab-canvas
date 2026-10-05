import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import {
  getRoomMeta,
  loadRoomDoc,
  persistRoomDocSync,
  scheduleRoomDocSave,
  startSnapshotInterval,
  stopSnapshotInterval,
} from './storage.js';
import { verifyRoomToken } from './security.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface RoomSession {
  roomId: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Set<WebSocket>;
}

export class CRDTServer {
  private rooms: Map<string, RoomSession> = new Map();
  private wss: WebSocketServer;

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupUpgrade(server);
  }

  private setupUpgrade(server: http.Server): void {
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const pathname = url.pathname;

      // Match /ws/:roomId
      const match = pathname.match(/^\/ws\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        socket.destroy();
        return;
      }

      const roomId = match[1];
      const token = url.searchParams.get('token') || '';

      // Check if room requires password
      const meta = getRoomMeta(roomId);
      if (meta && meta.passwordHash) {
        if (!verifyRoomToken(roomId, token)) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request, roomId);
      });
    });

    this.wss.on('connection', (ws: WebSocket, _req: http.IncomingMessage, roomId: string) => {
      this.handleConnection(ws, roomId);
    });
  }

  private getOrCreateRoom(roomId: string): RoomSession {
    let session = this.rooms.get(roomId);
    if (!session) {
      const doc = new Y.Doc();
      // Load saved snapshot if present
      loadRoomDoc(doc, roomId);

      const awareness = new awarenessProtocol.Awareness(doc);
      session = {
        roomId,
        doc,
        awareness,
        conns: new Set(),
      };

      // Listen for doc changes and broadcast to other peers + debounce disk save
      doc.on('update', (update: Uint8Array, origin: any) => {
        scheduleRoomDocSave(doc, roomId);

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        const message = encoding.toUint8Array(encoder);

        for (const conn of session!.conns) {
          if (conn !== origin && conn.readyState === WebSocket.OPEN) {
            conn.send(message);
          }
        }
      });

      // Awareness broadcasting
      awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
        const changedClients = added.concat(updated).concat(removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
        );
        const message = encoding.toUint8Array(encoder);

        for (const conn of session!.conns) {
          if (conn !== origin && conn.readyState === WebSocket.OPEN) {
            conn.send(message);
          }
        }
      });

      // Start periodic 10-minute snapshot creator
      startSnapshotInterval(doc, roomId);

      this.rooms.set(roomId, session);
    }
    return session;
  }

  private handleConnection(conn: WebSocket, roomId: string): void {
    const session = this.getOrCreateRoom(roomId);
    session.conns.add(conn);

    conn.binaryType = 'arraybuffer';

    // Send Step 1 Sync
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, session.doc);
    conn.send(encoding.toUint8Array(encoder));

    // Send existing awareness states
    const awarenessStates = session.awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
          session.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      conn.send(encoding.toUint8Array(awarenessEncoder));
    }

    conn.on('message', (message: ArrayBuffer) => {
      try {
        const uint8 = new Uint8Array(message);
        const decoder = decoding.createDecoder(uint8);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case MESSAGE_SYNC: {
            const replyEncoder = encoding.createEncoder();
            encoding.writeVarUint(replyEncoder, MESSAGE_SYNC);
            syncProtocol.readSyncMessage(decoder, replyEncoder, session.doc, conn);
            if (encoding.length(replyEncoder) > 1) {
              conn.send(encoding.toUint8Array(replyEncoder));
            }
            break;
          }
          case MESSAGE_AWARENESS: {
            awarenessProtocol.applyAwarenessUpdate(
              session.awareness,
              decoding.readVarUint8Array(decoder),
              conn
            );
            break;
          }
        }
      } catch (err) {
        console.error(`Error handling WS message in room ${roomId}:`, err);
      }
    });

    conn.on('close', () => {
      session.conns.delete(conn);
      if (session.conns.size === 0) {
        // Final sync to disk
        persistRoomDocSync(session.doc, roomId);
        stopSnapshotInterval(roomId);
        this.rooms.delete(roomId);
      }
    });

    conn.on('error', (err) => {
      console.error(`WS error in room ${roomId}:`, err);
    });
  }

  public getRoomDoc(roomId: string): Y.Doc | null {
    const session = this.rooms.get(roomId);
    return session ? session.doc : null;
  }
}
