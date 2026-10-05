import React, { useEffect, useState, useRef } from 'react';
import { CanvasElement, StrokeElement } from '@collabcanvas/shared';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { X, Play, Pause, RotateCcw } from 'lucide-react';
import { renderStrokePath, getFreehandOutline } from '../../engine/freehand.js';

interface Props {
  elements: CanvasElement[];
}

export const InkReplayModal: React.FC<Props> = ({ elements }) => {
  const { setActiveDrawer } = useCanvasStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter and sort strokes by createdAt
  const strokes = elements
    .filter((e) => e.type === 'stroke')
    .sort((a, b) => a.createdAt - b.createdAt) as StrokeElement[];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    drawStrokes(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= strokes.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 300 / speed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, strokes.length]);

  const drawStrokes = (count: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < count; i++) {
      const stroke = strokes[i];
      if (!stroke) continue;

      ctx.save();
      ctx.fillStyle = stroke.color;
      ctx.globalAlpha = stroke.opacity ?? 1.0;
      if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.5;
      }

      const outline = getFreehandOutline(stroke.points, stroke.tool, stroke.size);
      renderStrokePath(ctx, outline);
      ctx.restore();
    }
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
          width: '720px',
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
              Ink Replay ({currentIndex} / {strokes.length} strokes)
            </h3>
          </div>
          <button
            onClick={() => setActiveDrawer(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Canvas Display */}
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
            onClick={() => setIsPlaying(!isPlaying)}
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
            max={strokes.length}
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
