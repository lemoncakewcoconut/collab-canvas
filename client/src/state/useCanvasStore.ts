import { create } from 'zustand';
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PAPER_COLORS,
  PaperColor,
  PaperStyle,
  ShapeType,
  ToolType,
} from '@collabcanvas/shared';

export interface CanvasState {
  // Navigation & active tool
  activeTab: 'home' | 'draw' | 'insert' | 'view';
  activeTool: ToolType;
  setActiveTab: (tab: 'home' | 'draw' | 'insert' | 'view') => void;
  setActiveTool: (tool: ToolType) => void;

  // Inking
  penColor: string;
  penSize: number;
  highlighterColor: string;
  highlighterSize: number;
  inkToShapeEnabled: boolean;
  setPenColor: (color: string) => void;
  setPenSize: (size: number) => void;
  setHighlighterColor: (color: string) => void;
  setHighlighterSize: (size: number) => void;
  toggleInkToShape: () => void;

  // Shapes
  selectedShapeType: ShapeType;
  shapeStrokeColor: string;
  shapeFillColor: string;
  shapeFillStyle: 'solid' | 'hachure' | 'cross-hatch' | 'dots' | 'zigzag';
  shapeStrokeWidth: number;
  shapeStrokeStyle: 'solid' | 'dashed' | 'dotted';
  shapeRoughness: number;
  setSelectedShapeType: (shape: ShapeType) => void;
  setShapeStrokeColor: (color: string) => void;
  setShapeFillColor: (color: string) => void;
  setShapeFillStyle: (style: 'solid' | 'hachure' | 'cross-hatch' | 'dots' | 'zigzag') => void;
  setShapeStrokeWidth: (width: number) => void;
  setShapeStrokeStyle: (style: 'solid' | 'dashed' | 'dotted') => void;
  setShapeRoughness: (roughness: number) => void;

  // Ruler & Protractor
  isRulerVisible: boolean;
  rulerAngleDeg: number;
  rulerPos: { x: number; y: number };
  isProtractorVisible: boolean;
  protractorPos: { x: number; y: number };
  protractorRadius: number;
  toggleRuler: () => void;
  setRulerAngleDeg: (deg: number) => void;
  setRulerPos: (pos: { x: number; y: number }) => void;
  toggleProtractor: () => void;
  setProtractorPos: (pos: { x: number; y: number }) => void;
  setProtractorRadius: (radius: number) => void;

  // Viewport / Camera
  panX: number;
  panY: number;
  zoom: number;
  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  resetZoom: () => void;

  // Paper & background
  paperStyle: PaperStyle;
  paperColor: PaperColor;
  setPaperStyle: (style: PaperStyle) => void;
  setPaperColor: (color: PaperColor) => void;

  // UI Chrome & Drawers
  isDarkMode: boolean;
  isImmersive: boolean;
  activeDrawer: null | 'tags' | 'history' | 'replay';
  toggleDarkMode: () => void;
  toggleImmersive: () => void;
  setActiveDrawer: (drawer: null | 'tags' | 'history' | 'replay') => void;

  // Selection
  selectedIds: string[];
  editingElementId: string | null;
  setSelectedIds: (ids: string[]) => void;
  setEditingElementId: (id: string | null) => void;

  // User identity & Room
  roomId: string;
  roomTitle: string;
  username: string;
  userColor: string;
  hasPassword: boolean;
  isPasswordUnlocked: boolean;
  isOnline: boolean;
  setRoomInfo: (info: { id: string; title: string; hasPassword: boolean }) => void;
  setUsername: (name: string) => void;
  setUserColor: (color: string) => void;
  setIsPasswordUnlocked: (unlocked: boolean) => void;
  setIsOnline: (online: boolean) => void;
}

const USER_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6'
];

function getRandomUserColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

function getStoredUsername(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('collab_username') || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return 'Guest';
}

export const useCanvasStore = create<CanvasState>((set) => ({
  // Navigation & Tool
  activeTab: 'draw',
  activeTool: 'pen',
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveTool: (tool) => set({ activeTool: tool }),

  // Inking
  penColor: '#000000',
  penSize: 3,
  highlighterColor: '#FEF08A',
  highlighterSize: 24,
  inkToShapeEnabled: true,
  setPenColor: (color) => set({ penColor: color }),
  setPenSize: (size) => set({ penSize: size }),
  setHighlighterColor: (color) => set({ highlighterColor: color }),
  setHighlighterSize: (size) => set({ highlighterSize: size }),
  toggleInkToShape: () => set((s) => ({ inkToShapeEnabled: !s.inkToShapeEnabled })),

  // Shapes
  selectedShapeType: 'rectangle',
  shapeStrokeColor: '#000000',
  shapeFillColor: 'transparent',
  shapeFillStyle: 'solid',
  shapeStrokeWidth: 2,
  shapeStrokeStyle: 'solid',
  shapeRoughness: 1.0,
  setSelectedShapeType: (shape) => set({ selectedShapeType: shape, activeTool: 'shape' }),
  setShapeStrokeColor: (color) => set({ shapeStrokeColor: color }),
  setShapeFillColor: (color) => set({ shapeFillColor: color }),
  setShapeFillStyle: (style) => set({ shapeFillStyle: style }),
  setShapeStrokeWidth: (width) => set({ shapeStrokeWidth: width }),
  setShapeStrokeStyle: (style) => set({ shapeStrokeStyle: style }),
  setShapeRoughness: (roughness) => set({ shapeRoughness: roughness }),

  // Ruler & Protractor
  isRulerVisible: false,
  rulerAngleDeg: 0,
  rulerPos: { x: 300, y: 300 },
  isProtractorVisible: false,
  protractorPos: { x: 500, y: 300 },
  protractorRadius: 150,
  toggleRuler: () => set((s) => ({ isRulerVisible: !s.isRulerVisible })),
  setRulerAngleDeg: (deg) => set({ rulerAngleDeg: deg }),
  setRulerPos: (pos) => set({ rulerPos: pos }),
  toggleProtractor: () => set((s) => ({ isProtractorVisible: !s.isProtractorVisible })),
  setProtractorPos: (pos) => set({ protractorPos: pos }),
  setProtractorRadius: (radius) => set({ protractorRadius: radius }),

  // Viewport
  panX: 0,
  panY: 0,
  zoom: DEFAULT_ZOOM,
  setPan: (x, y) => set({ panX: x, panY: y }),
  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
  resetZoom: () => set({ zoom: 1.0 }),

  // Paper
  paperStyle: 'ruled-college',
  paperColor: 'white',
  setPaperStyle: (style) => set({ paperStyle: style }),
  setPaperColor: (color) => set({ paperColor: color }),

  // Chrome & Drawers
  isDarkMode: false,
  isImmersive: false,
  activeDrawer: null,
  toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
  toggleImmersive: () => set((s) => ({ isImmersive: !s.isImmersive })),
  setActiveDrawer: (drawer) => set({ activeDrawer: drawer }),

  // Selection
  selectedIds: [],
  editingElementId: null,
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setEditingElementId: (id) => set({ editingElementId: id }),

  // Identity & Room
  roomId: 'default',
  roomTitle: 'CollabCanvas Board',
  username: getStoredUsername(),
  userColor: getRandomUserColor(),
  hasPassword: false,
  isPasswordUnlocked: true,
  isOnline: false,
  setRoomInfo: (info) =>
    set({
      roomId: info.id,
      roomTitle: info.title,
      hasPassword: info.hasPassword,
      isPasswordUnlocked: !info.hasPassword,
    }),
  setUsername: (name) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('collab_username', name);
    }
    set({ username: name });
  },
  setUserColor: (color) => set({ userColor: color }),
  setIsPasswordUnlocked: (unlocked) => set({ isPasswordUnlocked: unlocked }),
  setIsOnline: (online) => set({ isOnline: online }),
}));
