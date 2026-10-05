/**
 * CollabCanvas Core Constants
 */

// File upload limits & chunking
export const UPLOAD_CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB per chunk
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max file size
export const MAX_PARALLEL_CHUNKS = 3;

// Ephemeral presence & network throttling
export const AWARENESS_THROTTLE_MS = 50; // ~20 Hz
export const PRESENCE_TIMEOUT_MS = 10000; // 10 seconds inactive timeout

// Canvas viewport & camera limits
export const MIN_ZOOM = 0.1; // 10%
export const MAX_ZOOM = 10.0; // 1000%
export const DEFAULT_ZOOM = 1.0;

// Spatial indexing & culling
export const QUADTREE_MAX_DEPTH = 12;
export const QUADTREE_MAX_ITEMS = 8;
export const VIEWPORT_CULLING_MARGIN = 200; // Extra px margin outside viewport for smooth panning
export const LOD_THRESHOLD_SIMPLIFY = 0.25; // When zoom < 25%, simplify lines/text

// Stacking / History limits
export const MAX_HISTORY_SNAPSHOTS = 50;
export const HISTORY_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
export const YDOC_DEBOUNCE_SAVE_MS = 2000; // 2 seconds debounced disk persistence

// Default canvas paper palette
export const PAPER_COLORS = {
  white: '#FFFFFF',
  cream: '#FFFDF0',
  ivory: '#FAF8F5',
  slate: '#1E293B',
  charcoal: '#18181B',
  black: '#0F172A'
} as const;

export const PEN_COLORS = [
  '#000000', // Black
  '#2563EB', // Blue
  '#DC2626', // Red
  '#16A34A', // Green
  '#9333EA', // Purple
  '#EA580C', // Orange
  '#0D9488', // Teal
  '#CA8A04', // Yellow / Gold
  '#475569', // Slate Gray
  '#FFFFFF'  // White
] as const;

export const HIGHLIGHTER_COLORS = [
  '#FEF08A', // Yellow (50% alpha recommended)
  '#BBF7D0', // Green
  '#BAE6FD', // Light Blue
  '#FBCFE8', // Pink
  '#FED7AA'  // Orange
] as const;

export const STICKY_COLORS = [
  '#FEF08A', // Yellow
  '#BAE6FD', // Blue
  '#BBF7D0', // Green
  '#FBCFE8', // Pink
  '#FED7AA', // Orange
  '#E9D5FF'  // Lavender
] as const;
