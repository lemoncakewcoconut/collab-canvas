import React from 'react';
import {
  Grid,
  Palette,
  ZoomIn,
  ZoomOut,
  Maximize,
  Moon,
  Sun,
  History,
  Eye,
  Minimize2,
} from 'lucide-react';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { PAPER_COLORS, PaperColor, PaperStyle } from '@collabcanvas/shared';
import { zoomToFitContent } from '../../engine/camera.js';
import { crdtBridge } from '../../state/crdtBridge.js';

export const ViewTab: React.FC = () => {
  const {
    paperStyle,
    setPaperStyle,
    paperColor,
    setPaperColor,
    zoom,
    setZoom,
    resetZoom,
    setPan,
    isDarkMode,
    toggleDarkMode,
    isImmersive,
    toggleImmersive,
    setActiveDrawer,
  } = useCanvasStore();

  const handleZoomToFit = () => {
    const elements = crdtBridge.getAllElements();
    const result = zoomToFitContent(elements, window.innerWidth, window.innerHeight);
    setPan(result.panX, result.panY);
    setZoom(result.zoom);
  };

  const paperStyles: { id: PaperStyle; label: string }[] = [
    { id: 'blank', label: 'Blank Page' },
    { id: 'ruled-college', label: 'College Ruled' },
    { id: 'ruled-narrow', label: 'Narrow Ruled' },
    { id: 'ruled-wide', label: 'Wide Ruled' },
    { id: 'grid-small', label: 'Small Grid' },
    { id: 'grid-medium', label: 'Medium Grid' },
    { id: 'grid-large', label: 'Large Grid' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '4px 8px' }}>
      {/* Paper Style Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Grid size={16} color="#2563EB" />
        <select
          value={paperStyle}
          onChange={(e) => setPaperStyle(e.target.value as PaperStyle)}
          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
        >
          {paperStyles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Paper Color Swatches */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        <Palette size={16} color="#64748b" />
        {(['white', 'cream', 'ivory', 'slate', 'charcoal', 'black'] as PaperColor[]).map((c) => (
          <button
            key={c}
            onClick={() => setPaperColor(c)}
            title={`Paper Color: ${c}`}
            style={{
              width: '18px',
              height: '18px',
              backgroundColor: PAPER_COLORS[c],
              border: paperColor === c ? '2px solid #2563EB' : '1px solid rgba(0,0,0,0.2)',
              borderRadius: '50%',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {/* Zoom Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        <button
          onClick={() => setZoom(zoom / 1.2)}
          title="Zoom Out"
          style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
        >
          <ZoomOut size={14} />
        </button>

        <button
          onClick={resetZoom}
          title="Reset to 100%"
          style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '12px', minWidth: '55px' }}
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={() => setZoom(zoom * 1.2)}
          title="Zoom In"
          style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
        >
          <ZoomIn size={14} />
        </button>

        <button
          onClick={handleZoomToFit}
          title="Zoom to Fit Content"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Maximize size={14} /> Fit Content
        </button>
      </div>

      {/* Dark Mode & Immersive View */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        <button
          onClick={toggleDarkMode}
          title="Toggle Dark Mode"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {isDarkMode ? <Sun size={14} color="#eab308" /> : <Moon size={14} color="#64748b" />}
          {isDarkMode ? 'Light' : 'Dark'}
        </button>

        <button
          onClick={toggleImmersive}
          title="Immersive Mode (Collapse ribbon for distraction-free canvas)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {isImmersive ? <Minimize2 size={14} /> : <Eye size={14} />}
          {isImmersive ? 'Show Ribbon' : 'Immersive'}
        </button>
      </div>

      {/* Version History Drawer */}
      <div style={{ marginLeft: 'auto' }}>
        <button
          onClick={() => setActiveDrawer('history')}
          title="Version History (View and restore saved snapshots)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#eff6ff',
            color: '#2563EB',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <History size={14} /> Version History
        </button>
      </div>
    </div>
  );
};
