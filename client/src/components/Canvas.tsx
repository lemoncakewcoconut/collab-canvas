import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvasStore } from '../state/useCanvasStore.js';
import { crdtBridge } from '../state/crdtBridge.js';
import { spatialIndex } from '../engine/spatialIndex.js';
import { canvasRenderer } from '../engine/renderer.js';
import {
  screenToWorld,
  worldToScreen,
  zoomAroundPoint,
} from '../engine/camera.js';
import {
  CanvasElement,
  createAABB,
  getElementBounds,
  lassoSelectsElement,
  Point,
  recognizeStroke,
  ShapeElement,
  snapToProtractor,
  snapToRuler,
  StrokeElement,
  UserPresence,
} from '@collabcanvas/shared';
import { DOMOverlays } from './overlays/DOMOverlays.js';

export const Canvas: React.FC = () => {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    activeTool,
    setActiveTool,
    penColor,
    penSize,
    highlighterColor,
    highlighterSize,
    inkToShapeEnabled,
    selectedShapeType,
    shapeStrokeColor,
    shapeFillColor,
    shapeStrokeWidth,
    shapeStrokeStyle,
    shapeRoughness,
    paperStyle,
    paperColor,
    isDarkMode,
    panX,
    panY,
    zoom,
    setPan,
    setZoom,
    selectedIds,
    setSelectedIds,
    username,
    userColor,
    isRulerVisible,
    rulerAngleDeg,
    rulerPos,
    isProtractorVisible,
    protractorPos,
    protractorRadius,
  } = useCanvasStore();

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [remotePresences, setRemotePresences] = useState<UserPresence[]>([]);

  // In-progress interactions state
  const activeStrokeRef = useRef<{
    points: Point[];
    tool: 'pen' | 'pencil' | 'highlighter';
    color: string;
    size: number;
  } | null>(null);

  const activeShapeRef = useRef<ShapeElement | null>(null);
  const shapeStartRef = useRef<Point | null>(null);
  const lassoPointsRef = useRef<Point[] | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpacePressedRef = useRef(false);

  // Selection dragging & Add Space tool
  const isDraggingSelectedRef = useRef(false);
  const dragLastPosRef = useRef<Point>({ x: 0, y: 0 });
  const spaceDragStartRef = useRef<number | null>(null);

  // Sync elements from CRDT
  useEffect(() => {
    const update = () => {
      setElements(crdtBridge.getAllElements());
    };
    update();
    const unsub = crdtBridge.subscribe(update);
    return () => unsub();
  }, []);

  // Sync remote awareness presences
  useEffect(() => {
    const unsub = crdtBridge.subscribeAwareness((presences) => {
      setRemotePresences(presences);
    });
    return () => unsub();
  }, []);

  // Keyboard shortcuts (Space for Pan, Escape to cancel, Ctrl+Z, Ctrl+Y, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        isSpacePressedRef.current = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          crdtBridge.redo();
        } else {
          crdtBridge.undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        crdtBridge.redo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0 && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          crdtBridge.deleteElements(selectedIds);
          setSelectedIds([]);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIds, setSelectedIds]);

  // Main rendering loop (RequestAnimationFrame)
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      const baseCanvas = baseCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (baseCanvas && overlayCanvas) {
        const baseCtx = baseCanvas.getContext('2d');
        const overlayCtx = overlayCanvas.getContext('2d');
        if (baseCtx && overlayCtx) {
          const dpr = window.devicePixelRatio || 1;
          const width = window.innerWidth;
          const height = window.innerHeight;

          if (baseCanvas.width !== width * dpr || baseCanvas.height !== height * dpr) {
            baseCanvas.width = width * dpr;
            baseCanvas.height = height * dpr;
            overlayCanvas.width = width * dpr;
            overlayCanvas.height = height * dpr;
          }

          // Query only visible elements via Quadtree culling
          const visibleElements = spatialIndex.queryVisible(panX, panY, zoom, width, height);

          canvasRenderer.render(visibleElements, {
            ctx: baseCtx,
            overlayCtx,
            width,
            height,
            dpr,
            panX,
            panY,
            zoom,
            paperStyle,
            paperColor,
            isDark: isDarkMode,
            selectedIds,
            remotePresences,
            activeStroke: activeStrokeRef.current,
            activeShapePreview: activeShapeRef.current,
            activeLassoPoints: lassoPointsRef.current,
            ruler: {
              x: rulerPos.x,
              y: rulerPos.y,
              length: 500,
              width: 70,
              angleDeg: rulerAngleDeg,
              visible: isRulerVisible,
            },
            protractor: {
              x: protractorPos.x,
              y: protractorPos.y,
              radius: protractorRadius,
              angleDeg: 0,
              visible: isProtractorVisible,
            },
          });
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [
    panX,
    panY,
    zoom,
    paperStyle,
    paperColor,
    isDarkMode,
    selectedIds,
    remotePresences,
    isRulerVisible,
    rulerAngleDeg,
    rulerPos,
    isProtractorVisible,
    protractorPos,
    protractorRadius,
  ]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY, panX, panY, zoom);

    // Pan with Middle Click or Space Key
    if (e.button === 1 || isSpacePressedRef.current) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
      return;
    }

    if (e.button !== 0) return; // Left click only for drawing

    // 1. Inking Tools
    if (activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'highlighter') {
      let pt: Point = {
        x: world.x,
        y: world.y,
        pressure: e.pressure || 0.5,
        time: Date.now(),
      };

      // Ruler / Protractor snapping
      if (isRulerVisible) {
        const snapped = snapToRuler(pt, {
          x: rulerPos.x,
          y: rulerPos.y,
          length: 500,
          width: 70,
          angleDeg: rulerAngleDeg,
          visible: true,
        });
        if (snapped) pt = snapped;
      } else if (isProtractorVisible) {
        const snapped = snapToProtractor(pt, {
          x: protractorPos.x,
          y: protractorPos.y,
          radius: protractorRadius,
          angleDeg: 0,
          visible: true,
        });
        if (snapped) pt = snapped;
      }

      const color = activeTool === 'highlighter' ? highlighterColor : penColor;
      const size = activeTool === 'highlighter' ? highlighterSize : penSize;

      activeStrokeRef.current = {
        points: [pt],
        tool: activeTool,
        color,
        size,
      };
      return;
    }

    // 2. Eraser (Strokes, Shapes, Notes, Media, Tables)
    if (activeTool === 'eraser-stroke' || activeTool === 'eraser-point') {
      eraseElementAt(world);
      return;
    }

    // 3. Shape Tool
    if (activeTool === 'shape') {
      shapeStartRef.current = world;
      activeShapeRef.current = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        shapeType: selectedShapeType,
        x: world.x,
        y: world.y,
        width: 0,
        height: 0,
        strokeColor: shapeStrokeColor,
        fillColor: shapeFillColor,
        strokeWidth: shapeStrokeWidth,
        strokeStyle: shapeStrokeStyle,
        roughness: shapeRoughness,
        zIndex: crdtBridge.getHighestZIndex(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return;
    }

    // 4. Lasso Select
    if (activeTool === 'lasso') {
      lassoPointsRef.current = [{ x: world.x, y: world.y }];
      return;
    }

    // 5. Add / Remove Space
    if (activeTool === 'space') {
      spaceDragStartRef.current = world.y;
      return;
    }

    // 6. Freeform Text Creation
    if (activeTool === 'text') {
      const id = `text-${Date.now()}`;
      const zIndex = crdtBridge.getHighestZIndex();
      crdtBridge.addElement({
        id,
        type: 'text',
        x: Math.round(world.x),
        y: Math.round(world.y),
        width: 280,
        height: 80,
        content: '',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        color: penColor || '#0f172a',
        zIndex,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setActiveTool('select');
      setSelectedIds([id]);
      return;
    }

    // 7. Sticky Note Creation
    if (activeTool === 'sticky') {
      const id = `sticky-${Date.now()}`;
      const zIndex = crdtBridge.getHighestZIndex();
      crdtBridge.addElement({
        id,
        type: 'sticky',
        x: Math.round(world.x),
        y: Math.round(world.y),
        width: 200,
        height: 180,
        text: 'New Note',
        color: '#FEF08A',
        fontSize: 16,
        zIndex,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setActiveTool('select');
      setSelectedIds([id]);
      return;
    }

    // 8. Select Tool
    if (activeTool === 'select') {
      const clicked = hitTestElement(world);
      if (clicked) {
        if (!selectedIds.includes(clicked.id)) {
          setSelectedIds([clicked.id]);
        }
        isDraggingSelectedRef.current = true;
        dragLastPosRef.current = world;
      } else {
        setSelectedIds([]);
        isDraggingSelectedRef.current = false;
      }
      return;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY, panX, panY, zoom);

    // Broadcast presence cursor throttled at 20 Hz
    crdtBridge.updatePresence({
      username,
      color: userColor,
      cursor: { x: world.x, y: world.y },
      selection: selectedIds,
      tool: activeTool,
    });

    // Panning
    if (isPanningRef.current) {
      setPan(e.clientX - panStartRef.current.x, e.clientY - panStartRef.current.y);
      return;
    }

    // Drag selected elements (shapes, images, notes, etc.)
    if (activeTool === 'select' && isDraggingSelectedRef.current && selectedIds.length > 0 && e.buttons === 1) {
      const dx = world.x - dragLastPosRef.current.x;
      const dy = world.y - dragLastPosRef.current.y;
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        dragLastPosRef.current = world;
        crdtBridge.shiftElements(dx, dy, selectedIds);
      }
      return;
    }

    // Live Inking
    if (activeStrokeRef.current) {
      let pt: Point = {
        x: world.x,
        y: world.y,
        pressure: e.pressure || 0.5,
        time: Date.now(),
      };

      if (isRulerVisible) {
        const snapped = snapToRuler(pt, {
          x: rulerPos.x,
          y: rulerPos.y,
          length: 500,
          width: 70,
          angleDeg: rulerAngleDeg,
          visible: true,
        });
        if (snapped) pt = snapped;
      } else if (isProtractorVisible) {
        const snapped = snapToProtractor(pt, {
          x: protractorPos.x,
          y: protractorPos.y,
          radius: protractorRadius,
          angleDeg: 0,
          visible: true,
        });
        if (snapped) pt = snapped;
      }

      activeStrokeRef.current.points.push(pt);
      return;
    }

    // Eraser drag (strokes, shapes, notes, media, tables)
    if ((activeTool === 'eraser-stroke' || activeTool === 'eraser-point') && e.buttons === 1) {
      eraseElementAt(world);
      return;
    }

    // Shape drag (directional for line/arrow/double_arrow, bounded for box/ellipse/polygons)
    if (activeShapeRef.current && shapeStartRef.current) {
      const start = shapeStartRef.current;
      const isLinear =
        activeShapeRef.current.shapeType === 'line' ||
        activeShapeRef.current.shapeType === 'arrow' ||
        activeShapeRef.current.shapeType === 'double_arrow';

      if (isLinear) {
        activeShapeRef.current.x = start.x;
        activeShapeRef.current.y = start.y;
        activeShapeRef.current.width = world.x - start.x;
        activeShapeRef.current.height = world.y - start.y;
      } else {
        activeShapeRef.current.x = Math.min(start.x, world.x);
        activeShapeRef.current.y = Math.min(start.y, world.y);
        activeShapeRef.current.width = Math.abs(world.x - start.x);
        activeShapeRef.current.height = Math.abs(world.y - start.y);
      }
      return;
    }

    // Lasso drag
    if (lassoPointsRef.current) {
      lassoPointsRef.current.push({ x: world.x, y: world.y });
      return;
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    isPanningRef.current = false;
    isDraggingSelectedRef.current = false;

    // 1. Finalize Stroke
    if (activeStrokeRef.current) {
      const stroke = activeStrokeRef.current;
      activeStrokeRef.current = null;

      if (stroke.points.length >= 2) {
        // Ink-to-Shape recognition check
        let recognized = false;
        if (inkToShapeEnabled && stroke.tool !== 'highlighter') {
          const shape = recognizeStroke(stroke.points);
          if (shape && shape.confidence >= 0.7) {
            recognized = true;
            const zIndex = crdtBridge.getHighestZIndex();
            crdtBridge.addElement({
              id: `shape-${Date.now()}`,
              type: 'shape',
              shapeType: shape.shapeType,
              x: shape.x,
              y: shape.y,
              width: shape.width,
              height: shape.height,
              strokeColor: stroke.color,
              fillColor: 'transparent',
              strokeWidth: stroke.size,
              strokeStyle: 'solid',
              roughness: 0, // crisp shape!
              zIndex,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        }

        if (!recognized) {
          // Regular stroke
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of stroke.points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }

          const pad = stroke.size * 1.5;
          const element: StrokeElement = {
            id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'stroke',
            tool: stroke.tool,
            color: stroke.color,
            size: stroke.size,
            opacity: stroke.tool === 'highlighter' ? 0.5 : 1.0,
            points: stroke.points,
            bounds: createAABB(minX - pad, minY - pad, maxX + pad, maxY + pad),
            zIndex: crdtBridge.getHighestZIndex(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          crdtBridge.addElement(element);
        }
      }
    }

    // 2. Finalize Shape
    if (activeShapeRef.current) {
      const shape = activeShapeRef.current;
      activeShapeRef.current = null;
      shapeStartRef.current = null;
      const isLinear =
        shape.shapeType === 'line' ||
        shape.shapeType === 'arrow' ||
        shape.shapeType === 'double_arrow';
      const dist = Math.hypot(shape.width, shape.height);
      if (isLinear ? dist > 6 : (shape.width > 5 || shape.height > 5)) {
        crdtBridge.addElement(shape);
      }
    }

    // 3. Finalize Lasso Selection
    if (lassoPointsRef.current) {
      const polygon = lassoPointsRef.current;
      lassoPointsRef.current = null;

      const selected: string[] = [];
      const allElements = crdtBridge.getAllElements();
      for (const el of allElements) {
        if (lassoSelectsElement(polygon, el)) {
          selected.push(el.id);
        }
      }
      setSelectedIds(selected);
      setActiveTool('select');
    }

    // 4. Finalize Add Space Tool
    if (spaceDragStartRef.current !== null) {
      spaceDragStartRef.current = null;
    }
  };

  // Zoom with Mouse Wheel or Trackpad Pinch
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const res = zoomAroundPoint(zoom, zoomFactor, { x: e.clientX, y: e.clientY }, { x: panX, y: panY });
      setZoom(res.zoom);
      setPan(res.panX, res.panY);
    } else {
      // Pan
      setPan(panX - e.deltaX, panY - e.deltaY);
    }
  };

  // OneNote Double-Click anywhere on blank canvas creates a rich text note
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'select') {
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = screenToWorld(screenX, screenY, panX, panY, zoom);

      const clicked = hitTestElement(world);
      if (!clicked) {
        const id = `text-${Date.now()}`;
        const zIndex = crdtBridge.getHighestZIndex();
        crdtBridge.addElement({
          id,
          type: 'text',
          x: Math.round(world.x),
          y: Math.round(world.y),
          width: 280,
          height: 80,
          content: '',
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          color: penColor || '#0f172a',
          zIndex,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        setSelectedIds([id]);
      }
    }
  };

  // Erase any element (strokes, shapes, notes, media, tables, equations, tags) touched by eraser
  const eraseElementAt = (world: Point) => {
    const eraserRadius = 24;
    const nearby = spatialIndex.queryVisible(panX, panY, zoom, window.innerWidth, window.innerHeight);

    const toDelete: string[] = [];
    for (const el of nearby) {
      const bounds = getElementBounds(el);
      if (
        world.x + eraserRadius >= bounds.minX &&
        world.x - eraserRadius <= bounds.maxX &&
        world.y + eraserRadius >= bounds.minY &&
        world.y - eraserRadius <= bounds.maxY
      ) {
        toDelete.push(el.id);
      }
    }

    if (toDelete.length > 0) {
      crdtBridge.deleteElements(toDelete);
    }
  };

  // Hit-test element
  const hitTestElement = (world: Point): CanvasElement | null => {
    const nearby = spatialIndex.queryVisible(panX, panY, zoom, window.innerWidth, window.innerHeight);
    for (let i = nearby.length - 1; i >= 0; i--) {
      const el = nearby[i];
      const b = getElementBounds(el);
      if (world.x >= b.minX && world.x <= b.maxX && world.y >= b.minY && world.y <= b.maxY) {
        return el;
      }
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onWheel={handleWheel}
      style={{ cursor: getCursorStyle(activeTool, isSpacePressedRef.current) }}
    >
      {/* Base Canvas: Scene elements, strokes, Rough.js shapes, grid */}
      <canvas
        ref={baseCanvasRef}
        className="canvas-layer"
        style={{ zIndex: 1, cursor: getCursorStyle(activeTool, isSpacePressedRef.current) }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />

      {/* DOM Overlays: Text, Stickies, Tables, Equations, Audio */}
      <DOMOverlays elements={elements} />

      {/* Ephemeral Overlay Canvas: In-progress stroke, Remote cursors, Selection box, Lasso, Ruler */}
      <canvas
        ref={overlayCanvasRef}
        className="canvas-layer"
        style={{ zIndex: 30, pointerEvents: 'none' }}
      />
    </div>
  );
};

function getCursorStyle(tool: string, spacePressed: boolean): string {
  if (spacePressed) return 'grab';
  switch (tool) {
    case 'pen':
    case 'pencil':
      return 'crosshair';
    case 'highlighter':
      return 'crosshair';
    case 'eraser-stroke':
    case 'eraser-point':
      return 'cell';
    case 'lasso':
      return 'crosshair';
    case 'text':
      return 'text';
    case 'space':
      return 'row-resize';
    default:
      return 'default';
  }
}
