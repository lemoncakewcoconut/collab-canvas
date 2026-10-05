/**
 * Shared Type Definitions for CollabCanvas
 */

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type ToolType =
  | 'select'
  | 'lasso'
  | 'pen'
  | 'pencil'
  | 'highlighter'
  | 'eraser-stroke'
  | 'eraser-point'
  | 'space'
  | 'shape'
  | 'text'
  | 'sticky'
  | 'table'
  | 'equation'
  | 'media'
  | 'ruler'
  | 'protractor';

export type ShapeType =
  | 'line'
  | 'arrow'
  | 'double_arrow'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'right_triangle'
  | 'parallelogram'
  | 'trapezoid'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'cube'
  | 'cylinder'
  | 'cone'
  | 'graph_axes';

export interface BaseElement {
  id: string;
  type: string;
  zIndex: string;
  createdAt: number;
  updatedAt: number;
}

export interface StrokeElement extends BaseElement {
  type: 'stroke';
  tool: 'pen' | 'pencil' | 'highlighter';
  color: string;
  size: number;
  opacity: number;
  points: Point[];
  bounds: AABB;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  angle?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // TipTap / HTML string or text
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface StickyNoteElement extends BaseElement {
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontSize: number;
}

export interface TableCell {
  text: string;
  bg?: string;
}

export interface TableElement extends BaseElement {
  type: 'table';
  x: number;
  y: number;
  rows: number;
  cols: number;
  cellData: Record<string, TableCell>; // key: `${row},${col}`
  cellWidths: number[];
  cellHeights: number[];
}

export interface EquationElement extends BaseElement {
  type: 'equation';
  x: number;
  y: number;
  width: number;
  height: number;
  latex: string;
}

export interface MediaElement extends BaseElement {
  type: 'media';
  x: number;
  y: number;
  width: number;
  height: number;
  assetId: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  naturalWidth?: number;
  naturalHeight?: number;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AudioElement extends BaseElement {
  type: 'audio';
  x: number;
  y: number;
  width: number;
  height: number;
  assetId: string;
  duration: number;
  fileName: string;
}

export type TagType = 'todo' | 'important' | 'question' | 'definition' | 'idea';

export interface TagElement extends BaseElement {
  type: 'tag';
  tagType: TagType;
  label: string;
  checked?: boolean;
  targetElementId?: string;
  x: number;
  y: number;
}

export type CanvasElement =
  | StrokeElement
  | ShapeElement
  | TextElement
  | StickyNoteElement
  | TableElement
  | EquationElement
  | MediaElement
  | AudioElement
  | TagElement;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type PaperStyle =
  | 'blank'
  | 'ruled-narrow'
  | 'ruled-college'
  | 'ruled-wide'
  | 'grid-small'
  | 'grid-medium'
  | 'grid-large';

export type PaperColor =
  | 'white'
  | 'cream'
  | 'ivory'
  | 'slate'
  | 'charcoal'
  | 'black';

export interface UserPresence {
  id: number;
  username: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selection: string[];
  tool: string;
  lastActive: number;
}

export interface RoomMeta {
  id: string;
  title: string;
  createdAt: number;
  hasPassword: boolean;
  versionCount?: number;
}

export interface RoomSnapshotMeta {
  timestamp: number;
  version: number;
  sizeBytes: number;
  fileName: string;
}

export type SnapshotMeta = RoomSnapshotMeta;

// REST API Contracts
export interface CreateRoomRequest {
  id?: string;
  title?: string;
  password?: string;
}

export interface CreateRoomResponse {
  room: RoomMeta;
  token?: string;
}

export interface AuthRoomRequest {
  password?: string;
}

export interface AuthRoomResponse {
  success: boolean;
  token?: string;
  error?: string;
}

export interface UploadInitRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256?: string;
}

export interface UploadInitResponse {
  uploadId: string;
  totalChunks: number;
  chunkSize: number;
  deduplicated?: boolean;
  assetId?: string;
}

export interface UploadChunkResponse {
  partIndex: number;
  received: boolean;
}

export interface UploadStatusResponse {
  uploadId: string;
  fileName: string;
  totalChunks: number;
  uploadedParts: number[];
  completed: boolean;
  assetId?: string;
}

export interface UploadCompleteResponse {
  success: boolean;
  assetId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface AssetMeta {
  assetId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: number;
  hasThumbnail: boolean;
}
