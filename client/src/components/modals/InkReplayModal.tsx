import React, { useEffect, useState, useRef, useMemo } from 'react';
import { CanvasElement, ShapeElement, StrokeElement } from '@collabcanvas/shared';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { X, Play, Pause, RotateCcw } from 'lucide-react';
import { renderStrokePath, getFreehandOutline } from '../../engine/freehand.js';
import rough from 'roughjs';

interface Props {
  elements: CanvasElement[];
}

export const InkReplayModal: React.FC<Props> = ({ elements }) => {
  const { setActiveDrawer } = useCanvasStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter and sort all drawn ink strokes and shapes by createdAt
  const replayItems = useMemo(() => {
    return elements
      .filter((e) => e.type === 'stroke' || e.type === 'shape')
      .sort((a, b) => a.createdAt - b.createdAt) as (StrokeElement | ShapeElement)[];
  }, [elements]);

  const [currentIndex, setCurrentIndex] = useState(replayItems.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate bounding box of all replay items to auto-center and scale accurately
  const bounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const item of replayItems) {
      if (item.type === 'stroke') {
        const s = item as StrokeElement;
        for (const pt of s.points) {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
      } else if (item.type === 'shape') {
        const sh = item as ShapeElement;
        const x2 = sh.x + sh.width;
        const y2 = sh.y + sh.height;
        const left = Math.min(sh.x, x2);
        const right = Math.max(sh.x, x2);
        const top = Math.min(sh.y, y2);
        const bottom = Math.max(sh.y, y2);
        if (left < minX) minX = left;
        if (right > maxX) maxX = right;
        if (top < minY) minY = top;
        if (bottom > maxY) maxY = bottom;
      }
    }

    if (minX === Infinity) return null;
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(40, maxX - minX),
      height: Math.max(40, maxY - minY),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [replayItems]);

  useEffect(() => {
    drawItems(currentIndex);
  }, [currentIndex, bounds]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= replayItems.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, Math.max(40, 260 / speed));
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, replayItems.length]);

  const drawItems = (count: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Empty state
    if (replayItems.length === 0 || !bounds) {
      ctx.save();
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'No ink strokes or shapes to replay. Draw something on the canvas first!',
        canvas.width / 2,
        canvas.height / 2
      );
      ctx.restore();
      return;
    }

    // Auto-fit & center calculations
    const padding = 36;
    const scale = Math.min(
      (canvas.width - padding * 2) / bounds.width,
      (canvas.height - padding * 2) / bounds.height,
      1.5
    );

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-bounds.centerX, -bounds.centerY);

    const rc = rough.canvas(canvas);

    for (let i = 0; i < count; i++) {
      const item = replayItems[i];
      if (!item) continue;

      if (item.type === 'stroke') {
        const stroke = item as StrokeElement;
        ctx.save();
        ctx.fillStyle = stroke.color;
        ctx.globalAlpha = stroke.opacity ?? 1.0;

        if (stroke.tool === 'highlighter') {
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 0.5;
        } else if (stroke.tool === 'pencil') {
          ctx.globalAlpha = Math.min(0.85, stroke.opacity ?? 0.85);
        }

        const outline = getFreehandOutline(stroke.points, stroke.tool, stroke.size);
        renderStrokePath(ctx, outline);
        ctx.restore();
      } else if (item.type === 'shape') {
        const shape = item as ShapeElement;
        ctx.save();

        if (shape.angle) {
          const cx = shape.x + shape.width / 2;
          const cy = shape.y + shape.height / 2;
          ctx.translate(cx, cy);
          ctx.rotate((shape.angle * Math.PI) / 180);
          ctx.translate(-cx, -cy);
        }

        const strokeLineDash =
          shape.strokeStyle === 'dashed' ? [8, 6] :
          shape.strokeStyle === 'dotted' ? [3, 5] :
          undefined;

        const options: any = {
          stroke: shape.strokeColor,
          strokeWidth: shape.strokeWidth,
          fill: shape.fillColor && shape.fillColor !== 'transparent' ? shape.fillColor : undefined,
          fillStyle: shape.fillStyle || 'solid',
          roughness: shape.roughness ?? 0,
          strokeLineDash,
          disableMultiStroke: (shape.roughness ?? 0) === 0,
        };

        if (shape.fillStyle === 'dots') options.fillWeight = 1.5;
        else if (shape.fillStyle === 'hachure' || shape.fillStyle === 'cross-hatch') {
          options.hachureGap = 6;
          options.hachureAngle = 60;
        } else if (shape.fillStyle === 'zigzag') {
          options.hachureGap = 8;
          options.zigzagOffset = 4;
        }

        const { x, y, width, height, shapeType } = shape;
        switch (shapeType) {
          case 'rectangle':
            rc.rectangle(x, y, width, height, options);
            break;
          case 'ellipse':
            rc.ellipse(x + width / 2, y + height / 2, Math.abs(width), Math.abs(height), options);
            break;
          case 'line':
            rc.line(x, y, x + width, y + height, options);
            break;
          case 'arrow': {
            rc.line(x, y, x + width, y + height, options);
            const angle = Math.atan2(height, width);
            const headLen = Math.min(24, Math.max(12, Math.hypot(width, height) * 0.25));
            rc.line(
              x + width,
              y + height,
              x + width - headLen * Math.cos(angle - Math.PI / 6),
              y + height - headLen * Math.sin(angle - Math.PI / 6),
              options
            );
            rc.line(
              x + width,
              y + height,
              x + width - headLen * Math.cos(angle + Math.PI / 6),
              y + height - headLen * Math.sin(angle + Math.PI / 6),
              options
            );
            break;
          }
          case 'triangle':
            rc.polygon(
              [
                [x + width / 2, y],
                [x + width, y + height],
                [x, y + height],
              ],
              options
            );
            break;
          case 'star': {
            const cx = x + width / 2;
            const cy = y + height / 2;
            const outerR = Math.min(Math.abs(width), Math.abs(height)) / 2;
            const innerR = outerR * 0.4;
            const pts: [number, number][] = [];
            for (let s = 0; s < 10; s++) {
              const a = (s * Math.PI) / 5 - Math.PI / 2;
              const r = s % 2 === 0 ? outerR : innerR;
              pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
            }
            rc.polygon(pts, options);
            break;
          }
          default:
            rc.rectangle(x, y, width, height, options);
            break;
        }

        ctx.restore();
      }
    }

    ctx.restore();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '740px',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Play size={16} color="#2563EB" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              Ink Replay ({currentIndex} / {replayItems.length} items)
            </h3>
          </div>
          <button
            onClick={() => setActiveDrawer(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Canvas Display with crisp auto-centered content */}
        <div style={{ padding: '16px', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
          <canvas
            ref={canvasRef}
            width={680}
            height={400}
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
            }}
          />
        </div>

        {/* Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <button
            onClick={() => {
              if (currentIndex >= replayItems.length) {
                setCurrentIndex(0);
              }
              setIsPlaying(!isPlaying);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#2563EB',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentIndex(0);
            }}
            title="Reset"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
          </button>

          {/* Scrub Slider */}
          <input
            type="range"
            min={0}
            max={replayItems.length}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(Number(e.target.value));
            }}
            style={{ flex: 1, cursor: 'pointer' }}
          />

          {/* Speed selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            <span>Speed:</span>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: speed === s ? '#eff6ff' : '#fff',
                  color: speed === s ? '#2563EB' : 'inherit',
                  cursor: 'pointer',
                  fontWeight: speed === s ? 600 : 400,
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
