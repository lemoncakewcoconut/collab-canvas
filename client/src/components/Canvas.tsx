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
    setRulerPos,
    setRulerAngleDeg,
    setProtractorPos,
    setProtractorRadius,
    shapeFillStyle,
  } = useCanvasStore();

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [remotePresences, setRemotePresences] = useState<UserPresence[]>([]);

  // In-progress interactions state
  const activeStrokeRef = useRef<{
    points: Point[];
    tool: 'pen' | 'pencil' | 'calligraphy' | 'highlighter';
    color: string;
    size: number;
  } | null>(null);

  const activeShapeRef = useRef<ShapeElement | null>(null);
  const shapeStartRef = useRef<Point | null>(null);
  const lassoPointsRef = useRef<Point[] | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSpacePressedRef = useRef(false);

  // Ruler & Protractor dragging
  const rulerDragRef = useRef<{
    mode: 'move' | 'rotate';
    startWorld: Point;
    startPos: { x: number; y: number };
    startAngle: number;
  } | null>(null);

  const protractorDragRef = useRef<{
    mode: 'move' | 'radius';
    startWorld: Point;
    startPos: { x: number; y: number };
    startRadius: number;
  } | null>(null);

  // Shape Resize & Rotate
  const shapeTransformRef = useRef<{
    mode: 'resize' | 'rotate';
    handle?: string;
    shapeId: string;
    startShape: ShapeElement;
    startWorld: Point;
    center: Point;
  } | null>(null);

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

    // 0a. Check Ruler Hit-test (Move body or Rotate ends)
    if (isRulerVisible) {
      const rad = (-rulerAngleDeg * Math.PI) / 180;
      const dx = world.x - rulerPos.x;
      const dy = world.y - rulerPos.y;
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
      if (rx >= 0 && rx <= 500 && ry >= 0 && ry <= 70) {
        if (rx < 55 || rx > 445) {
          rulerDragRef.current = {
            mode: 'rotate',
            startWorld: world,
            startPos: { ...rulerPos },
            startAngle: rulerAngleDeg,
          };
        } else {
          rulerDragRef.current = {
            mode: 'move',
            startWorld: world,
            startPos: { ...rulerPos },
            startAngle: rulerAngleDeg,
          };
        }
        return;
      }
    }

    // 0b. Check Protractor Hit-test (Move center or adjust radius rim)
    if (isProtractorVisible) {
      const dist = Math.hypot(world.x - protractorPos.x, world.y - protractorPos.y);
      if (dist <= protractorRadius + 20) {
        if (dist >= protractorRadius - 28) {
          protractorDragRef.current = {
            mode: 'radius',
            startWorld: world,
            startPos: { ...protractorPos },
            startRadius: protractorRadius,
          };
        } else if (dist <= 35) {
          protractorDragRef.current = {
            mode: 'move',
            startWorld: world,
            startPos: { ...protractorPos },
            startRadius: protractorRadius,
          };
        }
        if (protractorDragRef.current) return;
      }
    }

    // 1. Inking Tools (pen, pencil, calligraphy, highlighter)
    if (activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'calligraphy' || activeTool === 'highlighter') {
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
        fillStyle: shapeFillStyle,
        strokeWidth: shapeStrokeWidth,
        strokeStyle: shapeStrokeStyle,
        roughness: shapeRoughness,
        angle: 0,
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
      // Check handles on selected shape
      if (selectedIds.length === 1) {
        const selected = elements.find((el) => el.id === selectedIds[0]);
        if (selected && selected.type === 'shape') {
          const shape = selected as ShapeElement;
          const b = getElementBounds(shape);
          const pad = 6;
          const cx = (b.minX + b.maxX) / 2;
          const cy = (b.minY + b.maxY) / 2;
          const angle = shape.angle || 0;

          // Transform world coordinates into shape's unrotated frame
          const rad = (-angle * Math.PI) / 180;
          const lx = (world.x - cx) * Math.cos(rad) - (world.y - cy) * Math.sin(rad) + cx;
          const ly = (world.x - cx) * Math.sin(rad) + (world.y - cy) * Math.cos(rad) + cy;

          // Check top rotation knob
          const rotY = b.minY - pad - 22 / zoom;
          if (Math.hypot(lx - cx, ly - rotY) <= 14 / zoom) {
            shapeTransformRef.current = {
              mode: 'rotate',
              shapeId: shape.id,
              startShape: { ...shape },
              startWorld: world,
              center: { x: cx, y: cy },
            };
            return;
          }

          // Check 8 resize handles
          const handleTol = 10 / zoom;
          const handles: { id: string; x: number; y: number }[] = [
            { id: 'nw', x: b.minX - pad, y: b.minY - pad },
            { id: 'ne', x: b.maxX + pad, y: b.minY - pad },
            { id: 'sw', x: b.minX - pad, y: b.maxY + pad },
            { id: 'se', x: b.maxX + pad, y: b.maxY + pad },
            { id: 'n', x: cx, y: b.minY - pad },
            { id: 's', x: cx, y: b.maxY + pad },
            { id: 'w', x: b.minX - pad, y: cy },
            { id: 'e', x: b.maxX + pad, y: cy },
          ];

          for (const h of handles) {
            if (Math.hypot(lx - h.x, ly - h.y) <= handleTol) {
              shapeTransformRef.current = {
                mode: 'resize',
                handle: h.id,
                shapeId: shape.id,
                startShape: { ...shape },
                startWorld: world,
                center: { x: cx, y: cy },
              };
              return;
            }
          }
        }
      }

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

    // Ruler Dragging (Move and Rotate)
    if (rulerDragRef.current) {
      const { mode, startWorld, startPos, startAngle } = rulerDragRef.current;
      if (mode === 'move') {
        const dx = world.x - startWorld.x;
        const dy = world.y - startWorld.y;
        setRulerPos({ x: Math.round(startPos.x + dx), y: Math.round(startPos.y + dy) });
      } else if (mode === 'rotate') {
        const currentAngle = (Math.atan2(world.y - startPos.y, world.x - startPos.x) * 180) / Math.PI;
        const initialAngle = (Math.atan2(startWorld.y - startPos.y, startWorld.x - startPos.x) * 180) / Math.PI;
        const delta = currentAngle - initialAngle;
        const newAngle = (startAngle + delta + 360) % 360;
        setRulerAngleDeg(Math.round(newAngle));
      }
      return;
    }

    // Protractor Dragging (Move and Radius)
    if (protractorDragRef.current) {
      const { mode, startWorld, startPos } = protractorDragRef.current;
      if (mode === 'move') {
        const dx = world.x - startWorld.x;
        const dy = world.y - startWorld.y;
        setProtractorPos({ x: Math.round(startPos.x + dx), y: Math.round(startPos.y + dy) });
      } else if (mode === 'radius') {
        const r = Math.round(Math.hypot(world.x - startPos.x, world.y - startPos.y));
        setProtractorRadius(Math.max(60, Math.min(500, r)));
      }
      return;
    }

    // Shape Transform (Resize & Rotate)
    if (shapeTransformRef.current) {
      const { mode, handle, shapeId, startShape, startWorld, center } = shapeTransformRef.current;
      if (mode === 'rotate') {
        const angleRad = Math.atan2(world.y - center.y, world.x - center.x);
        const deg = Math.round(((angleRad * 180) / Math.PI + 90 + 360) % 360);
        crdtBridge.updateElement(shapeId, { angle: deg });
      } else if (mode === 'resize' && handle) {
        const dx = world.x - startWorld.x;
        const dy = world.y - startWorld.y;
        let newX = startShape.x;
        let newY = startShape.y;
        let newW = startShape.width;
        let newH = startShape.height;

        if (handle.includes('e')) newW = Math.max(10, Math.round(startShape.width + dx));
        if (handle.includes('s')) newH = Math.max(10, Math.round(startShape.height + dy));
        if (handle.includes('w')) {
          const candW = startShape.width - dx;
          if (candW >= 10) {
            newW = Math.round(candW);
            newX = Math.round(startShape.x + dx);
          }
        }
        if (handle.includes('n')) {
          const candH = startShape.height - dy;
          if (candH >= 10) {
            newH = Math.round(candH);
            newY = Math.round(startShape.y + dy);
          }
        }
        crdtBridge.updateElement(shapeId, { x: newX, y: newY, width: newW, height: newH });
      }
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
    rulerDragRef.current = null;
    protractorDragRef.current = null;
    shapeTransformRef.current = null;

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
              fillColor: shapeFillColor !== 'transparent' ? shapeFillColor : 'transparent',
              fillStyle: shapeFillStyle,
              strokeWidth: stroke.size,
              strokeStyle: shapeStrokeStyle,
              roughness: shapeRoughness,
              angle: 0,
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
    const all = crdtBridge.getAllElements();

    const toDelete: string[] = [];
    for (const el of all) {
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
    case 'calligraphy':
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
