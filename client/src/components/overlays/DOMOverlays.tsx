import React, { useState } from 'react';
import {
  AudioElement,
  CanvasElement,
  EquationElement,
  MediaElement,
  StickyNoteElement,
  TableElement,
  TagElement,
  TextElement,
} from '@collabcanvas/shared';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { crdtBridge } from '../../state/crdtBridge.js';
import { Plus, Trash2, CheckSquare, Square, Volume2 } from 'lucide-react';

interface Props {
  elements: CanvasElement[];
}

export const DOMOverlays: React.FC<Props> = ({ elements }) => {
  const { panX, panY, zoom, selectedIds, setSelectedIds } = useCanvasStore();

  // Screen transform helpers
  const toScreenX = (x: number) => x * zoom + panX;
  const toScreenY = (y: number) => y * zoom + panY;

  const domElements = elements.filter(
    (el) =>
      el.type === 'text' ||
      el.type === 'sticky' ||
      el.type === 'table' ||
      el.type === 'equation' ||
      el.type === 'media' ||
      el.type === 'audio' ||
      el.type === 'tag'
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 20,
      }}
    >
      {domElements.map((el) => {
        const screenX = toScreenX(el.x);
        const screenY = toScreenY(el.y);

        // Viewport culling for DOM elements
        if (
          screenX + 500 * zoom < -100 ||
          screenX > window.innerWidth + 100 ||
          screenY + 500 * zoom < -100 ||
          screenY > window.innerHeight + 100
        ) {
          return null;
        }

        return (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: `${screenX}px`,
              top: `${screenY}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              pointerEvents: 'auto',
            }}
          >
            {el.type === 'sticky' && <StickyNoteItem element={el as StickyNoteElement} />}
            {el.type === 'text' && <RichTextItem element={el as TextElement} />}
            {el.type === 'table' && <TableItem element={el as TableElement} />}
            {el.type === 'equation' && <EquationItem element={el as EquationElement} />}
            {el.type === 'media' && <MediaItem element={el as MediaElement} />}
            {el.type === 'audio' && <AudioItem element={el as AudioElement} />}
            {el.type === 'tag' && <TagItem element={el as TagElement} />}
          </div>
        );
      })}
    </div>
  );
};

// 1. Sticky Note Item
const StickyNoteItem: React.FC<{ element: StickyNoteElement }> = ({ element }) => {
  return (
    <div
      style={{
        width: `${element.width}px`,
        height: `${element.height}px`,
        backgroundColor: element.color || '#FEF08A',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)',
        borderRadius: '2px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <textarea
        defaultValue={element.text}
        onBlur={(e) => {
          crdtBridge.updateElement(element.id, { text: e.target.value });
        }}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: `${element.fontSize || 15}px`,
          lineHeight: '1.4',
          color: '#1e293b',
        }}
        placeholder="Type note..."
      />
    </div>
  );
};

// 2. Freeform Rich Text Item
const RichTextItem: React.FC<{ element: TextElement }> = ({ element }) => {
  return (
    <div
      style={{
        minWidth: '120px',
        padding: '4px',
        outline: 'none',
      }}
    >
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          crdtBridge.updateElement(element.id, { content: e.currentTarget.innerHTML });
        }}
        dangerouslySetInnerHTML={{ __html: element.content || 'Click to write note...' }}
        style={{
          minHeight: '24px',
          outline: 'none',
          fontSize: `${element.fontSize || 16}px`,
          fontFamily: element.fontFamily || 'Inter, sans-serif',
          color: element.color || '#0f172a',
          fontWeight: element.bold ? 'bold' : 'normal',
          fontStyle: element.italic ? 'italic' : 'normal',
          textDecoration: [
            element.underline ? 'underline' : '',
            element.strike ? 'line-through' : '',
          ].filter(Boolean).join(' ') || 'none',
          textAlign: element.align || 'left',
          userSelect: 'text',
        }}
      />
    </div>
  );
};

// 3. Interactive Table Item
const TableItem: React.FC<{ element: TableElement }> = ({ element }) => {
  const handleCellChange = (r: number, c: number, text: string) => {
    const newCellData = {
      ...element.cellData,
      [`${r},${c}`]: {
        ...element.cellData[`${r},${c}`],
        text,
      },
    };
    crdtBridge.updateElement(element.id, { cellData: newCellData });
  };

  const addRow = () => {
    const newRows = element.rows + 1;
    const newCellData = { ...element.cellData };
    for (let c = 0; c < element.cols; c++) {
      newCellData[`${newRows - 1},${c}`] = { text: `New Row`, bg: '#fff' };
    }
    crdtBridge.updateElement(element.id, {
      rows: newRows,
      cellHeights: [...element.cellHeights, 40],
      cellData: newCellData,
    });
  };

  const addCol = () => {
    const newCols = element.cols + 1;
    const newCellData = { ...element.cellData };
    for (let r = 0; r < element.rows; r++) {
      newCellData[`${r},${newCols - 1}`] = { text: r === 0 ? `Col ${newCols}` : '', bg: r === 0 ? '#f1f5f9' : '#fff' };
    }
    crdtBridge.updateElement(element.id, {
      cols: newCols,
      cellWidths: [...element.cellWidths, 120],
      cellData: newCellData,
    });
  };

  return (
    <div style={{ background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderRadius: '4px', padding: '4px' }}>
      <table style={{ borderCollapse: 'collapse', userSelect: 'text' }}>
        <tbody>
          {Array.from({ length: element.rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: element.cols }).map((_, c) => {
                const cell = element.cellData[`${r},${c}`] || { text: '' };
                const isHeader = r === 0;
                return (
                  <td
                    key={c}
                    style={{
                      border: '1px solid #cbd5e1',
                      padding: '4px 6px',
                      background: cell.bg || (isHeader ? '#f8fafc' : '#ffffff'),
                      minWidth: `${element.cellWidths[c] || 100}px`,
                      height: `${element.cellHeights[r] || 32}px`,
                    }}
                  >
                    <input
                      defaultValue={cell.text}
                      onBlur={(e) => handleCellChange(r, c, e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        width: '100%',
                        fontSize: isHeader ? '13px' : '12px',
                        fontWeight: isHeader ? 600 : 400,
                        color: '#0f172a',
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Table Expansion Buttons */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        <button
          onClick={addRow}
          style={{
            fontSize: '11px',
            padding: '2px 6px',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            background: '#f8fafc',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <Plus size={12} /> Add Row
        </button>

        <button
          onClick={addCol}
          style={{
            fontSize: '11px',
            padding: '2px 6px',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            background: '#f8fafc',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <Plus size={12} /> Add Column
        </button>
      </div>
    </div>
  );
};

// 4. Equation Item
const EquationItem: React.FC<{ element: EquationElement }> = ({ element }) => {
  const [editing, setEditing] = useState(false);
  const [latex, setLatex] = useState(element.latex);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        padding: '6px 12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {editing ? (
        <input
          autoFocus
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          onBlur={() => {
            setEditing(false);
            crdtBridge.updateElement(element.id, { latex });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setEditing(false);
              crdtBridge.updateElement(element.id, { latex });
            }
          }}
          style={{
            border: '1px solid #3b82f6',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '14px',
            fontFamily: 'monospace',
          }}
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{
            cursor: 'pointer',
            fontFamily: 'serif',
            fontSize: '17px',
            color: '#1e293b',
            letterSpacing: '0.5px',
          }}
          title="Click to edit formula"
        >
          {latex || 'Double click to enter LaTeX'}
        </div>
      )}
    </div>
  );
};

// 5. Media Item (Images/Files)
const MediaItem: React.FC<{ element: MediaElement }> = ({ element }) => {
  return (
    <div
      style={{
        width: `${element.width}px`,
        height: `${element.height}px`,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        borderRadius: '4px',
        overflow: 'hidden',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
      }}
    >
      {element.mimeType?.startsWith('image/') ? (
        <img
          src={`/api/assets/${element.assetId}`}
          alt={element.fileName}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <div
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            gap: '8px',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{element.fileName}</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {(element.fileSize / 1024).toFixed(1)} KB
          </span>
          <a
            href={`/api/assets/${element.assetId}`}
            download={element.fileName}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              background: '#2563EB',
              color: '#fff',
              borderRadius: '4px',
              textDecoration: 'none',
            }}
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
};

// 6. Audio Player Item (HTTP Range streaming)
const AudioItem: React.FC<{ element: AudioElement }> = ({ element }) => {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <Volume2 size={16} color="#2563EB" />
      <audio controls src={`/api/assets/${element.assetId}`} style={{ height: '32px' }} />
    </div>
  );
};

// 7. Tag Item (Synced To-Do checkbox & category badge)
const TagItem: React.FC<{ element: TagElement }> = ({ element }) => {
  const toggleCheck = () => {
    crdtBridge.updateElement(element.id, { checked: !element.checked });
  };

  const getTagColor = () => {
    switch (element.tagType) {
      case 'todo': return '#16a34a';
      case 'important': return '#dc2626';
      case 'question': return '#2563eb';
      case 'idea': return '#ca8a04';
      default: return '#475569';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: '#ffffff',
        border: `1px solid ${getTagColor()}`,
        borderRadius: '16px',
        padding: '3px 10px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: 'pointer',
      }}
      onClick={element.tagType === 'todo' ? toggleCheck : undefined}
    >
      {element.tagType === 'todo' ? (
        element.checked ? (
          <CheckSquare size={14} color="#16a34a" />
        ) : (
          <Square size={14} color="#64748b" />
        )
      ) : null}

      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: '#1e293b',
          textDecoration: element.checked ? 'line-through' : 'none',
        }}
      >
        {element.label}
      </span>
    </div>
  );
};
