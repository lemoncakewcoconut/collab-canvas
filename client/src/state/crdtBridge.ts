import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import {
  AWARENESS_THROTTLE_MS,
  CanvasElement,
  compareKeys,
  generateKeyBetween,
  Point,
  UserPresence,
} from '@collabcanvas/shared';

class CRDTBridge {
  public doc: Y.Doc;
  public elementsMap: Y.Map<CanvasElement>;
  public wsProvider: WebsocketProvider | null = null;
  public idbProvider: IndexeddbPersistence | null = null;
  public undoManager: Y.UndoManager;

  private listeners: Set<() => void> = new Set();
  private awarenessListeners: Set<(users: UserPresence[]) => void> = new Set();
  private lastBroadcastTime = 0;
  private lastCursorPos: { x: number; y: number } | null = null;
  private currentRoomId: string = '';

  constructor() {
    this.doc = new Y.Doc();
    this.elementsMap = this.doc.getMap('elements');

    // Scoped Undo/Redo to only this client's changes
    this.undoManager = new Y.UndoManager(this.elementsMap, {
      trackedOrigins: new Set([this.doc.clientID]),
    });

    this.elementsMap.observeDeep(() => {
      this.notifyListeners();
    });
  }

  public connect(roomId: string, token?: string): void {
    if (this.currentRoomId === roomId && this.wsProvider) {
      return;
    }

    this.disconnect();
    this.currentRoomId = roomId;

    // Offline IndexedDB persistence
    try {
      this.idbProvider = new IndexeddbPersistence(`collabcanvas_${roomId}`, this.doc);
    } catch (err) {
      console.warn('IndexedDB not available or disabled:', err);
    }

    // Determine WS URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const params: Record<string, string> = {};
    if (token) params.token = token;

    this.wsProvider = new WebsocketProvider(wsUrl, roomId, this.doc, {
      params,
      connect: true,
      maxBackoffTime: 5000,
    });

    this.wsProvider.awareness.on('change', () => {
      this.notifyAwarenessListeners();
    });
  }

  public disconnect(): void {
    if (this.wsProvider) {
      this.wsProvider.destroy();
      this.wsProvider = null;
    }
    if (this.idbProvider) {
      this.idbProvider.destroy();
      this.idbProvider = null;
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyListeners(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }

  public subscribeAwareness(cb: (users: UserPresence[]) => void): () => void {
    this.awarenessListeners.add(cb);
    return () => this.awarenessListeners.delete(cb);
  }

  private notifyAwarenessListeners(): void {
    if (!this.wsProvider) return;
    const states = this.wsProvider.awareness.getStates();
    const presences: UserPresence[] = [];

    states.forEach((state, clientID) => {
      if (clientID === this.doc.clientID) return; // skip self
      if (state.user) {
        presences.push({
          id: clientID,
          username: state.user.username || 'Anonymous',
          color: state.user.color || '#3b82f6',
          cursor: state.user.cursor || null,
          selection: state.user.selection || [],
          tool: state.user.tool || 'pen',
          lastActive: state.user.lastActive || Date.now(),
        });
      }
    });

    for (const cb of this.awarenessListeners) {
      cb(presences);
    }
  }

  /**
   * Broadcast local presence with 20 Hz throttle and stationary skipping
   */
  public updatePresence(info: {
    username: string;
    color: string;
    cursor: { x: number; y: number } | null;
    selection: string[];
    tool: string;
  }): void {
    if (!this.wsProvider) return;

    const now = Date.now();
    if (info.cursor && this.lastCursorPos) {
      const dx = Math.abs(info.cursor.x - this.lastCursorPos.x);
      const dy = Math.abs(info.cursor.y - this.lastCursorPos.y);
      // Skip stationary update
      if (dx < 1 && dy < 1 && now - this.lastBroadcastTime < 2000) {
        return;
      }
    }

    if (now - this.lastBroadcastTime < AWARENESS_THROTTLE_MS) {
      return;
    }

    this.lastBroadcastTime = now;
    if (info.cursor) {
      this.lastCursorPos = {
        x: Math.round(info.cursor.x),
        y: Math.round(info.cursor.y),
      };
    }

    this.wsProvider.awareness.setLocalStateField('user', {
      username: info.username,
      color: info.color,
      cursor: info.cursor ? { x: Math.round(info.cursor.x), y: Math.round(info.cursor.y) } : null,
      selection: info.selection,
      tool: info.tool,
      lastActive: now,
    });
  }

  // --- Element Manipulations ---

  public getAllElements(): CanvasElement[] {
    const list: CanvasElement[] = [];
    this.elementsMap.forEach((val) => {
      if (val && val.id) list.push(val);
    });
    return list.sort((a, b) => compareKeys(a.zIndex, b.zIndex));
  }

  public getElement(id: string): CanvasElement | undefined {
    return this.elementsMap.get(id);
  }

  public addElement(element: CanvasElement): void {
    this.doc.transact(() => {
      this.elementsMap.set(element.id, element);
    }, this.doc.clientID);
  }

  public updateElement(id: string, patch: Partial<CanvasElement>): void {
    const existing = this.elementsMap.get(id);
    if (!existing) return;

    this.doc.transact(() => {
      const updated = {
        ...existing,
        ...patch,
        updatedAt: Date.now(),
      } as CanvasElement;
      this.elementsMap.set(id, updated);
    }, this.doc.clientID);
  }

  public deleteElements(ids: string[]): void {
    this.doc.transact(() => {
      for (const id of ids) {
        this.elementsMap.delete(id);
      }
    }, this.doc.clientID);
  }

  public shiftElements(dx: number, dy: number, ids?: string[]): void {
    const targetIds = ids || Array.from(this.elementsMap.keys());
    this.doc.transact(() => {
      for (const id of targetIds) {
        const el = this.elementsMap.get(id);
        if (!el) continue;

        if (el.type === 'stroke') {
          const shiftedPoints = el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
          this.elementsMap.set(id, {
            ...el,
            points: shiftedPoints,
            bounds: {
              minX: el.bounds.minX + dx,
              minY: el.bounds.minY + dy,
              maxX: el.bounds.maxX + dx,
              maxY: el.bounds.maxY + dy,
            },
            updatedAt: Date.now(),
          });
        } else {
          this.elementsMap.set(id, {
            ...el,
            x: el.x + dx,
            y: el.y + dy,
            updatedAt: Date.now(),
          });
        }
      }
    }, this.doc.clientID);
  }

  public getHighestZIndex(): string {
    let highest: string | null = null;
    this.elementsMap.forEach((el) => {
      if (!highest || compareKeys(el.zIndex, highest) > 0) {
        highest = el.zIndex;
      }
    });
    return generateKeyBetween(highest, null);
  }

  public getLowestZIndex(): string {
    let lowest: string | null = null;
    this.elementsMap.forEach((el) => {
      if (!lowest || compareKeys(el.zIndex, lowest) < 0) {
        lowest = el.zIndex;
      }
    });
    return generateKeyBetween(null, lowest);
  }

  public undo(): void {
    this.undoManager.undo();
  }

  public redo(): void {
    this.undoManager.redo();
  }

  public canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }
}

export const crdtBridge = new CRDTBridge();
