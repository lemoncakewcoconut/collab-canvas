import { RoomMeta, SnapshotMeta } from '@collabcanvas/shared';

export async function fetchRooms(): Promise<RoomMeta[]> {
  const res = await fetch('/api/rooms');
  if (!res.ok) throw new Error('Failed to fetch rooms');
  const data = await res.json();
  return data.rooms;
}

export async function createRoom(title?: string, password?: string): Promise<{ room: RoomMeta; token?: string }> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, password }),
  });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

export async function authenticateRoom(roomId: string, password?: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const res = await fetch(`/api/rooms/${roomId}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.json();
}

export async function fetchRoomHistory(roomId: string): Promise<SnapshotMeta[]> {
  const res = await fetch(`/api/rooms/${roomId}/history`);
  if (!res.ok) throw new Error('Failed to fetch snapshots');
  const data = await res.json();
  return data.snapshots;
}

export async function restoreRoomSnapshot(roomId: string, timestamp: number): Promise<boolean> {
  const res = await fetch(`/api/rooms/${roomId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp }),
  });
  return res.ok;
}
