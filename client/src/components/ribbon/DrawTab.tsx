import React, { useState } from 'react';
import {
  Pen,
  Highlighter,
  Eraser,
  Lasso,
  Shapes,
  Maximize2,
  Sparkles,
  Ruler,
  Compass,
  Play,
  Spline,
  ArrowRight,
  Square,
  Circle,
  Triangle,
  MoveVertical,
  Feather,
} from 'lucide-react';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { HIGHLIGHTER_COLORS, PEN_COLORS, ShapeType } from '@collabcanvas/shared';

export const DrawTab: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    penColor,
    setPenColor,
    penSize,
    setPenSize,
    highlighterColor,
    setHighlighterColor,
    inkToShapeEnabled,
    toggleInkToShape,
    selectedShapeType,
    setSelectedShapeType,
    shapeStrokeColor,
    setShapeStrokeColor,
    shapeFillColor,
    setShapeFillColor,
    shapeFillStyle,
    setShapeFillStyle,
    shapeStrokeWidth,
    setShapeStrokeWidth,
    shapeStrokeStyle,
    setShapeStrokeStyle,
    shapeRoughness,
    setShapeRoughness,
    isRulerVisible,
    toggleRuler,
    isProtractorVisible,
    toggleProtractor,
    setActiveDrawer,
  } = useCanvasStore();

  const [showShapeMenu, setShowShapeMenu] = useState(false);

  const shapeList: { type: ShapeType; label: string; icon: any }[] = [
    { type: 'rectangle', label: 'Rectangle', icon: Square },
    { type: 'ellipse', label: 'Ellipse / Circle', icon: Circle },
    { type: 'triangle', label: 'Triangle', icon: Triangle },
    { type: 'line', label: 'Line', icon: Spline },
    { type: 'arrow', label: 'Arrow', icon: ArrowRight },
    { type: 'diamond', label: 'Diamond', icon: Shapes },
    { type: 'star', label: 'Star', icon: Shapes },
    { type: 'cube', label: '3D Cube', icon: Shapes },
    { type: 'cylinder', label: '3D Cylinder', icon: Shapes },
    { type: 'cone', label: '3D Cone', icon: Shapes },
    { type: 'graph_axes', label: 'Graph Axes', icon: MoveVertical },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '4px 8px' }}>
      {/* Tool Selection */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.04)', borderRadius: '8px', padding: '3px' }}>
        <button
          title="Ballpoint / Felt Pen"
          onClick={() => setActiveTool('pen')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            background: activeTool === 'pen' ? '#2563EB' : 'transparent',
            color: activeTool === 'pen' ? '#fff' : 'inherit',
          }}
        >
          <Pen size={16} /> Pen
        </button>

        <button
          title="Calligraphy Brush (Tapered pressure stroke)"
          onClick={() => setActiveTool('calligraphy')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            background: activeTool === 'calligraphy' ? '#2563EB' : 'transparent',
            color: activeTool === 'calligraphy' ? '#fff' : 'inherit',
          }}
        >
          <Feather size={16} /> Calligraphy
        </button>

        <button
          title="Pencil (Textured graphite lead)"
          onClick={() => setActiveTool('pencil')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            background: activeTool === 'pencil' ? '#2563EB' : 'transparent',
            color: activeTool === 'pencil' ? '#fff' : 'inherit',
          }}
        >
          <Pen size={16} style={{ strokeDasharray: '2,2' }} /> Pencil
        </button>

        <button
          title="Highlighter (Multiply blend pigment)"
          onClick={() => setActiveTool('highlighter')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            background: activeTool === 'highlighter' ? '#2563EB' : 'transparent',
            color: activeTool === 'highlighter' ? '#fff' : 'inherit',
          }}
        >
          <Highlighter size={16} /> Highlighter
        </button>

        <button
          title="Stroke Eraser (Deletes entire stroke)"
          onClick={() => setActiveTool('eraser-stroke')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            background: activeTool === 'eraser-stroke' ? '#2563EB' : 'transparent',
            color: activeTool === 'eraser-stroke' ? '#fff' : 'inherit',
          }}
        >
          <Eraser size={16} /> Eraser
        </button>

        <button
          title="Lasso Selection"
          onClick={() => setActiveTool('lasso')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            background: activeTool === 'lasso' ? '#2563EB' : 'transparent',
            color: activeTool === 'lasso' ? '#fff' : 'inherit',
          }}
        >
          <Lasso size={16} /> Lasso
        </button>

        <button
          title="Add / Remove Space (Shift canvas items vertically)"
          onClick={() => setActiveTool('space')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            background: activeTool === 'space' ? '#2563EB' : 'transparent',
            color: activeTool === 'space' ? '#fff' : 'inherit',
          }}
        >
          <MoveVertical size={16} /> Add Space
        </button>
      </div>

      {/* Inking Palette */}
      {(activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'calligraphy') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '3px' }}>
            {PEN_COLORS.slice(0, 6).map((c) => (
              <button
                key={c}
                onClick={() => setPenColor(c)}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: penColor === c ? '2px solid #2563EB' : '1px solid rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transform: penColor === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
          <select
            value={penSize}
            onChange={(e) => setPenSize(Number(e.target.value))}
            style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
          >
            <option value={2}>Thin (2px)</option>
            <option value={4}>Medium (4px)</option>
            <option value={8}>Thick (8px)</option>
            <option value={14}>Marker (14px)</option>
          </select>
        </div>
      )}

      {activeTool === 'highlighter' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '3px' }}>
            {HIGHLIGHTER_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setHighlighterColor(c)}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: highlighterColor === c ? '2px solid #2563EB' : '1px solid rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transform: highlighterColor === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Shapes Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowShapeMenu(!showShapeMenu)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: 'pointer',
            background: activeTool === 'shape' ? '#eff6ff' : '#fff',
            color: activeTool === 'shape' ? '#2563EB' : 'inherit',
          }}
        >
          <Shapes size={16} /> Shapes ({selectedShapeType})
        </button>

        {showShapeMenu && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              padding: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              zIndex: 100,
              width: '320px',
            }}
          >
            {shapeList.map((s) => (
              <button
                key={s.type}
                onClick={() => {
                  setSelectedShapeType(s.type);
                  setShowShapeMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px',
                  fontSize: '12px',
                  border: selectedShapeType === s.type ? '1px solid #2563EB' : '1px solid #e2e8f0',
                  borderRadius: '4px',
                  background: selectedShapeType === s.type ? '#eff6ff' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <s.icon size={14} /> {s.label}
              </button>
            ))}

            <div style={{ gridColumn: 'span 3', borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Stroke:
                  <select
                    value={shapeStrokeStyle}
                    onChange={(e) => setShapeStrokeStyle(e.target.value as any)}
                    style={{ padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="solid">Solid ───</option>
                    <option value="dashed">Dashed ╌╌╌</option>
                    <option value="dotted">Dotted ···</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Width:
                  <select
                    value={shapeStrokeWidth}
                    onChange={(e) => setShapeStrokeWidth(Number(e.target.value))}
                    style={{ padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value={1}>1px</option>
                    <option value={2}>2px</option>
                    <option value={4}>4px</option>
                    <option value={6}>6px</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Roughness:
                  <select
                    value={shapeRoughness}
                    onChange={(e) => setShapeRoughness(Number(e.target.value))}
                    style={{ padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value={0}>Crisp (0)</option>
                    <option value={1.2}>Hand-drawn (1)</option>
                    <option value={2.5}>Sketchy (2)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Fill Style:
                  <select
                    value={shapeFillStyle}
                    onChange={(e) => setShapeFillStyle(e.target.value as any)}
                    style={{ padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="solid">Solid Fill</option>
                    <option value="hachure">Hachure Lines ///</option>
                    <option value="cross-hatch">Cross-Hatch XXX</option>
                    <option value="dots">Stippled Dots :::</option>
                    <option value="zigzag">Zigzag ∿∿∿</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Fill Color:
                  <select
                    value={shapeFillColor}
                    onChange={(e) => setShapeFillColor(e.target.value)}
                    style={{ padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="transparent">Transparent</option>
                    <option value="#dbeafe">Light Blue</option>
                    <option value="#fef08a">Light Yellow</option>
                    <option value="#dcfce7">Light Green</option>
                    <option value="#fce7f3">Light Pink</option>
                    <option value="#ffedd5">Light Orange</option>
                    <option value="#f1f5f9">Slate Gray</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inking Intelligence & Geometry Overlay Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
        <button
          title="Ink-to-Shape (Auto recognizes rough circles, rects, triangles, lines into shapes)"
          onClick={toggleInkToShape}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            border: inkToShapeEnabled ? '1px solid #2563EB' : '1px solid #cbd5e1',
            borderRadius: '6px',
            background: inkToShapeEnabled ? '#eff6ff' : '#fff',
            color: inkToShapeEnabled ? '#2563EB' : '#64748b',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Sparkles size={14} /> Ink-to-Shape
        </button>

        <button
          title="Toggle Ruler (Snap strokes to straight edges)"
          onClick={toggleRuler}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            border: isRulerVisible ? '1px solid #2563EB' : '1px solid #cbd5e1',
            borderRadius: '6px',
            background: isRulerVisible ? '#eff6ff' : '#fff',
            color: isRulerVisible ? '#2563EB' : '#64748b',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Ruler size={14} /> Ruler
        </button>

        <button
          title="Toggle Protractor (Snap strokes to circular arcs & angles)"
          onClick={toggleProtractor}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            border: isProtractorVisible ? '1px solid #2563EB' : '1px solid #cbd5e1',
            borderRadius: '6px',
            background: isProtractorVisible ? '#eff6ff' : '#fff',
            color: isProtractorVisible ? '#2563EB' : '#64748b',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Compass size={14} /> Protractor
        </button>

        <button
          title="Ink Replay (Play back strokes step-by-step)"
          onClick={() => setActiveDrawer('replay')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fff',
            color: '#0f172a',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Play size={14} /> Replay
        </button>
      </div>
    </div>
  );
};
