import React, { useState, useRef, useEffect } from 'react';
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
import {
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Volume2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Maximize2,
  Move,
  GripHorizontal,
  Calculator,
  BookOpen,
} from 'lucide-react';
import katex from 'katex';

interface Props {
  elements: CanvasElement[];
}

export const DOMOverlays: React.FC<Props> = ({ elements }) => {
  const { panX, panY, zoom, selectedIds, setSelectedIds, activeTool } = useCanvasStore();

  // Screen transform helpers
  const toScreenX = (x: number) => x * zoom + panX;
  const toScreenY = (y: number) => y * zoom + panY;

  // When activeTool is inking, DOM overlay items disable pointerEvents so strokes draw freely across elements
  const isInking =
    activeTool === 'pen' ||
    activeTool === 'pencil' ||
    activeTool === 'highlighter' ||
    activeTool === 'eraser-stroke' ||
    activeTool === 'eraser-point' ||
    activeTool === 'lasso';

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
          screenX + 800 * zoom < -200 ||
          screenX > window.innerWidth + 200 ||
          screenY + 800 * zoom < -200 ||
          screenY > window.innerHeight + 200
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
              pointerEvents: isInking ? 'none' : 'auto',
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

// 1. OneNote-Style Sticky Note Item with Drag Header
const StickyNoteItem: React.FC<{ element: StickyNoteElement }> = ({ element }) => {
  const { zoom, selectedIds, setSelectedIds } = useCanvasStore();
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = selectedIds.includes(element.id);

  // Drag-to-move header handler
  const handleDragPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    setSelectedIds([element.id]);
    let lastX = e.clientX;
    let lastY = e.clientY;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - lastX) / zoom;
      const dy = (moveEv.clientY - lastY) / zoom;
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        lastX = moveEv.clientX;
        lastY = moveEv.clientY;
        crdtBridge.shiftElements(dx, dy, [element.id]);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedIds([element.id]);
      }}
      style={{
        width: `${element.width || 200}px`,
        height: `${element.height || 180}px`,
        backgroundColor: element.color || '#FEF08A',
        boxShadow: isSelected
          ? '0 0 0 2px #2563EB, 0 10px 15px -3px rgba(0,0,0,0.2)'
          : '0 4px 6px -1px rgba(0,0,0,0.15)',
        borderRadius: '3px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      {/* Drag Bar & Controls */}
      <div
        onPointerDown={handleDragPointerDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.06)',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.7 }}>
          <GripHorizontal size={14} />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>Note</span>
        </div>
        {(isHovered || isSelected) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              crdtBridge.deleteElements([element.id]);
            }}
            title="Delete Sticky Note"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#dc2626',
              padding: '1px',
              display: 'flex',
            }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, padding: '8px', display: 'flex' }}>
        <textarea
          defaultValue={element.text}
          onFocus={() => setSelectedIds([element.id])}
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

      {/* Corner Resize Handle */}
      {isSelected && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = element.width || 200;
            const startH = element.height || 180;

            const onPointerMove = (moveEv: PointerEvent) => {
              const dx = (moveEv.clientX - startX) / zoom;
              const dy = (moveEv.clientY - startY) / zoom;
              const newW = Math.max(120, Math.round(startW + dx));
              const newH = Math.max(100, Math.round(startH + dy));
              crdtBridge.updateElement(element.id, { width: newW, height: newH });
            };

            const onPointerUp = () => {
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', onPointerUp);
            };

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
          }}
          title="Drag to resize note"
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            width: '12px',
            height: '12px',
            cursor: 'nwse-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.6,
          }}
        >
          <div style={{ width: '6px', height: '6px', borderBottom: '2px solid #000', borderRight: '2px solid #000' }} />
        </div>
      )}
    </div>
  );
};

// 2. OneNote Freeform Rich Text Note Container with Move Handle & Live Typography
const RichTextItem: React.FC<{ element: TextElement }> = ({ element }) => {
  const { zoom, selectedIds, setSelectedIds } = useCanvasStore();
  const [isHovered, setIsHovered] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const isSelected = selectedIds.includes(element.id);

  // Sync content into editable div only when NOT focused to avoid cursor jumping
  useEffect(() => {
    if (editorRef.current && !isFocusedRef.current) {
      const currentHTML = editorRef.current.innerHTML;
      const targetHTML = element.content || '';
      if (currentHTML !== targetHTML) {
        editorRef.current.innerHTML = targetHTML;
      }
    }
  }, [element.content]);

  // Auto-focus when newly selected and empty
  useEffect(() => {
    if (isSelected && (!element.content || element.content === '') && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isSelected]);

  // Drag-to-move container handler
  const handleDragPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    setSelectedIds([element.id]);
    let lastX = e.clientX;
    let lastY = e.clientY;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - lastX) / zoom;
      const dy = (moveEv.clientY - lastY) / zoom;
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        lastX = moveEv.clientX;
        lastY = moveEv.clientY;
        crdtBridge.shiftElements(dx, dy, [element.id]);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Drag-to-resize container width
  const handleWidthResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startW = element.width || 280;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - startX) / zoom;
      const newWidth = Math.max(140, Math.round(startW + dx));
      crdtBridge.updateElement(element.id, { width: newWidth });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const isEmpty =
    !element.content ||
    element.content.trim() === '' ||
    element.content === '<br>' ||
    element.content === '<p></p>' ||
    element.content === '<p><br></p>';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedIds([element.id]);
      }}
      style={{
        width: `${element.width || 280}px`,
        position: 'relative',
        borderRadius: '6px',
        border: isSelected ? '1px solid #2563EB' : isHovered ? '1px dashed #cbd5e1' : '1px solid transparent',
        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.96)' : isHovered ? 'rgba(255, 255, 255, 0.7)' : 'transparent',
        boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.1)' : 'none',
        transition: 'border 0.1s ease, box-shadow 0.1s ease',
      }}
    >
      {/* OneNote Container Top Header (Drag handle & Delete) */}
      {(isSelected || isHovered) && (
        <div
          onPointerDown={handleDragPointerDown}
          title="Drag to move note container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '3px 8px',
            background: isSelected ? '#2563EB' : '#e2e8f0',
            color: isSelected ? '#ffffff' : '#475569',
            borderTopLeftRadius: '5px',
            borderTopRightRadius: '5px',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Move size={12} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>Note Container</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              crdtBridge.deleteElements([element.id]);
            }}
            title="Delete Note"
            style={{
              background: 'transparent',
              border: 'none',
              color: isSelected ? '#ffffff' : '#dc2626',
              cursor: 'pointer',
              padding: '1px',
              display: 'flex',
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Editable Body */}
      <div style={{ padding: '8px 10px', position: 'relative', minHeight: '36px' }}>
        {/* Placeholder when empty */}
        {isEmpty && !isFocusedRef.current && (
          <div
            onClick={() => editorRef.current?.focus()}
            style={{
              position: 'absolute',
              top: '8px',
              left: '10px',
              color: '#94a3b8',
              fontSize: `${element.fontSize || 16}px`,
              fontFamily: element.fontFamily || 'Inter, sans-serif',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            Click to write notes...
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => {
            isFocusedRef.current = true;
            setSelectedIds([element.id]);
          }}
          onBlur={(e) => {
            isFocusedRef.current = false;
            crdtBridge.updateElement(element.id, { content: e.currentTarget.innerHTML });
          }}
          onInput={(e) => {
            crdtBridge.updateElement(element.id, { content: e.currentTarget.innerHTML });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              document.execCommand('insertText', false, '    ');
            }
          }}
          style={{
            minHeight: '28px',
            outline: 'none',
            fontSize: `${element.fontSize || 16}px`,
            fontFamily: element.fontFamily || 'Inter, sans-serif',
            color: element.color || '#0f172a',
            fontWeight: element.bold ? 'bold' : 'normal',
            fontStyle: element.italic ? 'italic' : 'normal',
            textDecoration: [
              element.underline ? 'underline' : '',
              element.strike ? 'line-through' : '',
            ]
              .filter(Boolean)
              .join(' ') || 'none',
            textAlign: element.align || 'left',
            userSelect: 'text',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        />
      </div>

      {/* Right Edge Width Resize Handle */}
      {isSelected && (
        <div
          onPointerDown={handleWidthResizeDown}
          title="Drag to resize note width"
          style={{
            position: 'absolute',
            top: 0,
            right: '-5px',
            width: '10px',
            height: '100%',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <div style={{ width: '4px', height: '24px', background: '#2563EB', borderRadius: '2px' }} />
        </div>
      )}

      {/* Bottom-Right Corner Resize Handle */}
      {isSelected && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startW = element.width || 280;

            const onPointerMove = (moveEv: PointerEvent) => {
              const dx = (moveEv.clientX - startX) / zoom;
              const newWidth = Math.max(140, Math.round(startW + dx));
              crdtBridge.updateElement(element.id, { width: newWidth });
            };

            const onPointerUp = () => {
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', onPointerUp);
            };

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
          }}
          title="Drag to resize note"
          style={{
            position: 'absolute',
            bottom: '-5px',
            right: '-5px',
            width: '12px',
            height: '12px',
            cursor: 'nwse-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 15,
          }}
        >
          <div style={{ width: '7px', height: '7px', background: '#2563EB', borderRadius: '1px' }} />
        </div>
      )}
    </div>
  );
};

// 3. Interactive Table Item with Drag Header
const TableItem: React.FC<{ element: TableElement }> = ({ element }) => {
  const { zoom, selectedIds, setSelectedIds } = useCanvasStore();
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = selectedIds.includes(element.id);

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

  const handleDragPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    e.stopPropagation();
    setSelectedIds([element.id]);
    let lastX = e.clientX;
    let lastY = e.clientY;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - lastX) / zoom;
      const dy = (moveEv.clientY - lastY) / zoom;
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        lastX = moveEv.clientX;
        lastY = moveEv.clientY;
        crdtBridge.shiftElements(dx, dy, [element.id]);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
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
      newCellData[`${r},${newCols - 1}`] = {
        text: r === 0 ? `Col ${newCols}` : '',
        bg: r === 0 ? '#f1f5f9' : '#fff',
      };
    }
    crdtBridge.updateElement(element.id, {
      cols: newCols,
      cellWidths: [...element.cellWidths, 120],
      cellData: newCellData,
    });
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedIds([element.id]);
      }}
      style={{
        background: '#fff',
        boxShadow: isSelected
          ? '0 0 0 2px #2563EB, 0 10px 15px -3px rgba(0,0,0,0.15)'
          : '0 4px 6px -1px rgba(0,0,0,0.1)',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
      }}
    >
      {/* Top Drag Header */}
      <div
        onPointerDown={handleDragPointerDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: isSelected ? '#2563EB' : '#f1f5f9',
          color: isSelected ? '#ffffff' : '#475569',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Move size={12} />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>Table ({element.rows}×{element.cols})</span>
        </div>
        {(isHovered || isSelected) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              crdtBridge.deleteElements([element.id]);
            }}
            title="Delete Table"
            style={{
              background: 'transparent',
              border: 'none',
              color: isSelected ? '#ffffff' : '#dc2626',
              cursor: 'pointer',
              padding: '1px',
              display: 'flex',
            }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div style={{ padding: '6px' }}>
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
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          <button
            onClick={addRow}
            style={{
              fontSize: '11px',
              padding: '2px 8px',
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
              padding: '2px 8px',
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

      {/* Table Corner Resize Handle */}
      {isSelected && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidths = [...element.cellWidths];
            const startHeights = [...element.cellHeights];
            const totalStartW = startWidths.reduce((a, b) => a + b, 0);
            const totalStartH = startHeights.reduce((a, b) => a + b, 0);

            const onPointerMove = (moveEv: PointerEvent) => {
              const dx = (moveEv.clientX - startX) / zoom;
              const dy = (moveEv.clientY - startY) / zoom;
              const scaleW = Math.max(0.4, (totalStartW + dx) / Math.max(1, totalStartW));
              const scaleH = Math.max(0.4, (totalStartH + dy) / Math.max(1, totalStartH));

              const newWidths = startWidths.map((w) => Math.max(40, Math.round(w * scaleW)));
              const newHeights = startHeights.map((h) => Math.max(24, Math.round(h * scaleH)));
              crdtBridge.updateElement(element.id, { cellWidths: newWidths, cellHeights: newHeights });
            };

            const onPointerUp = () => {
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', onPointerUp);
            };

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
          }}
          title="Drag to resize table cells"
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            width: '14px',
            height: '14px',
            cursor: 'nwse-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
          }}
        >
          <div style={{ width: '8px', height: '8px', backgroundColor: '#2563EB', borderRadius: '2px' }} />
        </div>
      )}
    </div>
  );
};

// Helper to evaluate basic mathematical / arithmetic LaTeX expressions
function evaluateMathExpression(raw: string): string | null {
  try {
    let expr = raw
      .replace(/\\cdot/g, '*')
      .replace(/\\times/g, '*')
      .replace(/\\div/g, '/')
      .replace(/\\sqrt\{([^}]+)\}/g, 'Math.sqrt($1)')
      .replace(/\\sin\(([^)]+)\)/g, 'Math.sin($1)')
      .replace(/\\cos\(([^)]+)\)/g, 'Math.cos($1)')
      .replace(/\\tan\(([^)]+)\)/g, 'Math.tan($1)')
      .replace(/\\pi/g, 'Math.PI')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '(($1)/($2))')
      .replace(/\^\{([^}]+)\}/g, '**($1)')
      .replace(/\^(\d+)/g, '**$1')
      .replace(/[{}]/g, '')
      .replace(/=/g, '')
      .trim();

    // Whitelist safe characters
    if (/^[0-9+\-*/().\s,Math.sqrtsincoatePI]+$/.test(expr)) {
      const val = Function(`"use strict"; return (${expr});`)();
      if (typeof val === 'number' && !isNaN(val)) {
        return Number.isInteger(val) ? val.toString() : val.toFixed(4).replace(/\.?0+$/, '');
      }
    }
  } catch {}
  return null;
}

// 4. Fully Functional LaTeX Equation Item with KaTeX Rendering & Math Solver
const EquationItem: React.FC<{ element: EquationElement }> = ({ element }) => {
  const { zoom, selectedIds, setSelectedIds } = useCanvasStore();
  const [editing, setEditing] = useState(false);
  const [latex, setLatex] = useState(element.latex);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = selectedIds.includes(element.id);

  // Sync latex when element updates
  useEffect(() => {
    setLatex(element.latex);
  }, [element.latex]);

  const FORMULA_TEMPLATES = [
    { label: 'Quadratic Formula', code: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
    { label: 'Pythagorean Theorem', code: 'a^2 + b^2 = c^2' },
    { label: 'Calculus Integral', code: '\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)' },
    { label: 'Euler’s Identity', code: 'e^{i\\pi} + 1 = 0' },
    { label: 'Circle Area', code: 'A = \\pi r^2' },
    { label: 'Derivative', code: '\\frac{d}{dx}(x^n) = n x^{n-1}' },
    { label: 'Arithmetic Calc', code: '25 \\times 4 + \\sqrt{144}' },
  ];

  const handleDragPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    e.stopPropagation();
    setSelectedIds([element.id]);
    let lastX = e.clientX;
    let lastY = e.clientY;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - lastX) / zoom;
      const dy = (moveEv.clientY - lastY) / zoom;
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        lastX = moveEv.clientX;
        lastY = moveEv.clientY;
        crdtBridge.shiftElements(dx, dy, [element.id]);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleSolve = () => {
    const res = evaluateMathExpression(latex);
    if (res !== null) {
      crdtBridge.updateElement(element.id, { result: res });
    } else {
      alert(`Could not evaluate algebraic expression. Try an arithmetic formula like: 25 * 4 + \\sqrt{144}`);
    }
  };

  let renderedHtml = '';
  try {
    renderedHtml = katex.renderToString(latex || 'f(x) = y', {
      throwOnError: false,
      displayMode: false,
    });
  } catch (err: any) {
    renderedHtml = `<span>${latex}</span>`;
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedIds([element.id]);
      }}
      style={{
        background: '#ffffff',
        border: isSelected ? '1px solid #2563EB' : '1px solid #cbd5e1',
        borderRadius: '6px',
        boxShadow: isSelected
          ? '0 0 0 2px #2563EB, 0 4px 6px -1px rgba(0,0,0,0.1)'
          : '0 2px 4px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* Top Header & Toolbar */}
      <div
        onPointerDown={handleDragPointerDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3px 8px',
          background: isSelected ? '#2563EB' : '#f1f5f9',
          color: isSelected ? '#ffffff' : '#475569',
          borderTopLeftRadius: '5px',
          borderTopRightRadius: '5px',
          cursor: 'grab',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Move size={12} />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>Equation</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Templates button */}
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            title="Formula Templates"
            style={{
              background: 'transparent',
              border: 'none',
              color: isSelected ? '#ffffff' : '#2563eb',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '11px',
              padding: '2px 4px',
              borderRadius: '3px',
            }}
          >
            <BookOpen size={12} /> Templates
          </button>

          {/* Solve / Evaluate button */}
          <button
            onClick={handleSolve}
            title="Evaluate expression"
            style={{
              background: isSelected ? '#ffffff' : '#2563eb',
              border: 'none',
              color: isSelected ? '#2563eb' : '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '3px',
            }}
          >
            <Calculator size={12} /> Calculate
          </button>

          {(isHovered || isSelected) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                crdtBridge.deleteElements([element.id]);
              }}
              title="Delete Equation"
              style={{
                background: 'transparent',
                border: 'none',
                color: isSelected ? '#ffffff' : '#dc2626',
                cursor: 'pointer',
                padding: '1px',
                display: 'flex',
              }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Templates Dropdown Menu */}
      {showTemplates && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
            zIndex: 100,
            width: '260px',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', padding: '2px 4px' }}>
            Choose Formula:
          </span>
          {FORMULA_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.label}
              onClick={() => {
                setLatex(tmpl.code);
                setShowTemplates(false);
                crdtBridge.updateElement(element.id, { latex: tmpl.code, result: undefined });
              }}
              style={{
                textAlign: 'left',
                fontSize: '12px',
                padding: '4px 6px',
                border: 'none',
                borderRadius: '4px',
                background: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontWeight: 500 }}>{tmpl.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Body: KaTeX render or editable input */}
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              padding: '4px 8px',
              fontSize: '14px',
              fontFamily: 'monospace',
              width: '100%',
              minWidth: '220px',
            }}
            placeholder="Type LaTeX e.g. x^2 + y^2 = r^2"
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            title="Click to edit LaTeX formula"
            style={{
              cursor: 'pointer',
              fontSize: '18px',
              color: '#0f172a',
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            {element.result && (
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#16a34a',
                  background: '#dcfce7',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  marginLeft: '6px',
                }}
              >
                = {element.result}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 5. Fully Interactive Resizable, Zoomable, Movable Picture / Media Item
const MediaItem: React.FC<{ element: MediaElement }> = ({ element }) => {
  const { zoom, selectedIds, setSelectedIds } = useCanvasStore();
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localSize, setLocalSize] = useState<{ width: number; height: number }>({
    width: element.width || 320,
    height: element.height || 240,
  });

  const isSelected = selectedIds.includes(element.id);

  // Sync local size when element updates from CRDT
  useEffect(() => {
    if (!isResizing) {
      setLocalSize({
        width: element.width || 320,
        height: element.height || 240,
      });
    }
  }, [element.width, element.height, isResizing]);

  // Adjust aspect ratio and record natural size on image load
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const naturalAspect = img.naturalWidth / img.naturalHeight;
      const currentAspect = (element.width || 320) / (element.height || 240 || 1);
      const updates: Partial<MediaElement> = {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };

      if (!element.naturalWidth || Math.abs(currentAspect - naturalAspect) > 0.3) {
        updates.height = Math.round((element.width || 320) / naturalAspect);
      }
      crdtBridge.updateElement(element.id, updates);
    }
  };

  // Drag-to-move picture across the canvas
  const handleBodyPointerDown = (e: React.PointerEvent) => {
    if (isResizing) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.resize-handle')) {
      return;
    }
    e.stopPropagation();
    setSelectedIds([element.id]);
    let lastX = e.clientX;
    let lastY = e.clientY;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - lastX) / zoom;
      const dy = (moveEv.clientY - lastY) / zoom;
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        lastX = moveEv.clientX;
        lastY = moveEv.clientY;
        crdtBridge.shiftElements(dx, dy, [element.id]);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Multi-directional corner & edge resize handler
  const handleResizeStart = (
    direction: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 's',
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setSelectedIds([element.id]);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = localSize.width;
    const startH = localSize.height;
    const startElX = element.x;
    const startElY = element.y;
    const aspect =
      element.naturalWidth && element.naturalHeight && element.naturalHeight > 0
        ? element.naturalWidth / element.naturalHeight
        : startW / Math.max(1, startH);

    let currentW = startW;
    let currentH = startH;
    let currentX = startElX;
    let currentY = startElY;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - startX) / zoom;
      const dy = (moveEv.clientY - startY) / zoom;

      if (direction === 'se') {
        currentW = Math.max(80, Math.round(startW + dx));
        currentH = Math.max(60, Math.round(currentW / aspect));
      } else if (direction === 'sw') {
        currentW = Math.max(80, Math.round(startW - dx));
        currentH = Math.max(60, Math.round(currentW / aspect));
        currentX = startElX + (startW - currentW);
      } else if (direction === 'ne') {
        currentW = Math.max(80, Math.round(startW + dx));
        currentH = Math.max(60, Math.round(currentW / aspect));
        currentY = startElY + (startH - currentH);
      } else if (direction === 'nw') {
        currentW = Math.max(80, Math.round(startW - dx));
        currentH = Math.max(60, Math.round(currentW / aspect));
        currentX = startElX + (startW - currentW);
        currentY = startElY + (startH - currentH);
      } else if (direction === 'e') {
        currentW = Math.max(80, Math.round(startW + dx));
        currentH = Math.max(60, Math.round(currentW / aspect));
      } else if (direction === 's') {
        currentH = Math.max(60, Math.round(startH + dy));
        currentW = Math.max(80, Math.round(currentH * aspect));
      }

      setLocalSize({ width: currentW, height: currentH });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setIsResizing(false);
      crdtBridge.updateElement(element.id, {
        width: currentW,
        height: currentH,
        x: currentX,
        y: currentY,
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Zoom scale buttons
  const handleZoomBy = (factor: number) => {
    const newW = Math.max(80, Math.round(element.width * factor));
    const newH = Math.max(60, Math.round(element.height * factor));
    crdtBridge.updateElement(element.id, { width: newW, height: newH });
  };

  const handleResetOriginal = () => {
    const w = element.naturalWidth || 400;
    const h = element.naturalHeight || 300;
    crdtBridge.updateElement(element.id, { width: w, height: h });
  };

  const handleRotateBy = (delta: number) => {
    const currentAngle = element.angle || 0;
    const newAngle = ((currentAngle + delta) % 360 + 360) % 360;
    crdtBridge.updateElement(element.id, { angle: newAngle });
  };

  const handleResetAngle = () => {
    crdtBridge.updateElement(element.id, { angle: 0 });
  };

  const handleDelete = () => {
    crdtBridge.deleteElements([element.id]);
    setSelectedIds([]);
  };

  const handleRotateStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedIds([element.id]);
    const parent = e.currentTarget.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - centerX;
      const dy = moveEv.clientY - centerY;
      let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);
      deg = ((deg % 360) + 360) % 360;
      if (moveEv.shiftKey) {
        deg = Math.round(deg / 15) * 15;
      }
      crdtBridge.updateElement(element.id, { angle: deg });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const assetSrc =
    element.assetId?.startsWith('data:') ||
    element.assetId?.startsWith('blob:') ||
    element.assetId?.startsWith('http')
      ? element.assetId
      : `/api/assets/${element.assetId}`;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handleBodyPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedIds([element.id]);
      }}
      style={{
        width: `${localSize.width}px`,
        height: `${localSize.height}px`,
        transform: `rotate(${element.angle || 0}deg)`,
        transformOrigin: 'center center',
        boxShadow: isSelected
          ? '0 0 0 2px #2563EB, 0 12px 24px -4px rgba(0,0,0,0.2)'
          : isHovered
          ? '0 4px 12px rgba(0,0,0,0.15)'
          : '0 4px 6px -1px rgba(0,0,0,0.1)',
        borderRadius: '6px',
        position: 'relative',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        userSelect: 'none',
        cursor: 'move',
        transition: isResizing ? 'none' : 'box-shadow 0.15s ease',
      }}
    >
      {/* Floating Toolbar on Hover or Selection */}
      {(isHovered || isSelected) && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '-42px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(6px)',
            borderRadius: '24px',
            padding: '4px 10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 100,
          }}
        >
          {/* Dimension Chip */}
          <span style={{ fontSize: '11px', color: '#94a3b8', paddingRight: '4px', fontWeight: 500 }}>
            {Math.round(localSize.width)}×{Math.round(localSize.height)}
          </span>

          {Boolean(element.angle) && (
            <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600, paddingRight: '4px' }}>
              {element.angle}°
            </span>
          )}

          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />

          {/* Orientation Rotation Controls */}
          <button
            onClick={() => handleRotateBy(-15)}
            title="Rotate Left (-15°)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={() => handleRotateBy(15)}
            title="Rotate Right (+15°)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <RotateCw size={13} />
          </button>

          <button
            onClick={() => handleRotateBy(90)}
            title="Rotate 90° Clockwise"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            90°
          </button>

          {Boolean(element.angle) && (
            <button
              onClick={handleResetAngle}
              title="Reset Rotation (0°)"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#60a5fa',
                cursor: 'pointer',
                padding: '3px 4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              0°
            </button>
          )}

          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />

          <button
            onClick={() => handleZoomBy(1.25)}
            title="Make Bigger (+25%)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <ZoomIn size={14} />
          </button>

          <button
            onClick={() => handleZoomBy(0.8)}
            title="Make Smaller (-20%)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <ZoomOut size={14} />
          </button>

          <button
            onClick={handleResetOriginal}
            title="Reset Natural Size (100%)"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <Maximize2 size={13} />
          </button>

          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />

          <button
            onClick={handleDelete}
            title="Delete Image"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Image Content */}
      {element.mimeType?.startsWith('image/') ? (
        <img
          src={assetSrc}
          alt={element.fileName}
          onLoad={handleImageLoad}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            borderRadius: '5px',
            pointerEvents: 'none',
          }}
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
            href={assetSrc}
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

      {/* Top Rotation Knob & Stem */}
      {(isSelected || isHovered) && (
        <>
          <div
            className="rotate-handle"
            onPointerDown={handleRotateStart}
            title="Drag to rotate picture (Hold Shift to snap 15°)"
            style={{
              position: 'absolute',
              top: '-26px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '14px',
              height: '14px',
              backgroundColor: '#ffffff',
              border: '2px solid #2563EB',
              borderRadius: '50%',
              cursor: 'grab',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '-14px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '1.5px',
              height: '14px',
              backgroundColor: '#2563EB',
              pointerEvents: 'none',
              zIndex: 35,
            }}
          />
        </>
      )}

      {/* 4 Interactive Corner Handles & 2 Edge Handles (Visible when selected or hovered) */}
      {(isSelected || isHovered) && (
        <>
          {/* Bottom-Right (SE) - Primary corner */}
          <div
            className="resize-handle"
            onPointerDown={(e) => handleResizeStart('se', e)}
            title="Drag to resize image (keeps aspect ratio)"
            style={{
              position: 'absolute',
              bottom: '-7px',
              right: '-7px',
              width: '14px',
              height: '14px',
              backgroundColor: '#2563EB',
              border: '2px solid #ffffff',
              borderRadius: '3px',
              cursor: 'nwse-resize',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              zIndex: 30,
            }}
          />

          {/* Bottom-Left (SW) */}
          <div
            className="resize-handle"
            onPointerDown={(e) => handleResizeStart('sw', e)}
            title="Drag to resize image"
            style={{
              position: 'absolute',
              bottom: '-7px',
              left: '-7px',
              width: '14px',
              height: '14px',
              backgroundColor: '#2563EB',
              border: '2px solid #ffffff',
              borderRadius: '3px',
              cursor: 'nesw-resize',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              zIndex: 30,
            }}
          />

          {/* Top-Right (NE) */}
          <div
            className="resize-handle"
            onPointerDown={(e) => handleResizeStart('ne', e)}
            title="Drag to resize image"
            style={{
              position: 'absolute',
              top: '-7px',
              right: '-7px',
              width: '14px',
              height: '14px',
              backgroundColor: '#2563EB',
              border: '2px solid #ffffff',
              borderRadius: '3px',
              cursor: 'nesw-resize',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              zIndex: 30,
            }}
          />

          {/* Top-Left (NW) */}
          <div
            className="resize-handle"
            onPointerDown={(e) => handleResizeStart('nw', e)}
            title="Drag to resize image"
            style={{
              position: 'absolute',
              top: '-7px',
              left: '-7px',
              width: '14px',
              height: '14px',
              backgroundColor: '#2563EB',
              border: '2px solid #ffffff',
              borderRadius: '3px',
              cursor: 'nwse-resize',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              zIndex: 30,
            }}
          />

          {/* Right Edge (E) */}
          <div
            className="resize-handle"
            onPointerDown={(e) => handleResizeStart('e', e)}
            title="Drag to adjust width"
            style={{
              position: 'absolute',
              top: '50%',
              right: '-5px',
              transform: 'translateY(-50%)',
              width: '8px',
              height: '18px',
              backgroundColor: '#2563EB',
              border: '1px solid #ffffff',
              borderRadius: '2px',
              cursor: 'ew-resize',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              zIndex: 30,
            }}
          />

          {/* Bottom Edge (S) */}
          <div
            className="resize-handle"
            onPointerDown={(e) => handleResizeStart('s', e)}
            title="Drag to adjust height"
            style={{
              position: 'absolute',
              bottom: '-5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '18px',
              height: '8px',
              backgroundColor: '#2563EB',
              border: '1px solid #ffffff',
              borderRadius: '2px',
              cursor: 'ns-resize',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              zIndex: 30,
            }}
          />
        </>
      )}
    </div>
  );
};

// 6. Audio Player Item (HTTP Range streaming)
const AudioItem: React.FC<{ element: AudioElement }> = ({ element }) => {
  const assetSrc =
    element.assetId?.startsWith('data:') ||
    element.assetId?.startsWith('blob:') ||
    element.assetId?.startsWith('http')
      ? element.assetId
      : `/api/assets/${element.assetId}`;

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
      <audio controls src={assetSrc} style={{ height: '32px' }} />
    </div>
  );
};

// 7. Tag Item (Synced To-Do checkbox & movable category badge)
const TagItem: React.FC<{ element: TagElement }> = ({ element }) => {
  const { zoom, selectedIds, setSelectedIds } = useCanvasStore();
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = selectedIds.includes(element.id);
  const dragDistRef = useRef(0);

  const toggleCheck = () => {
    crdtBridge.updateElement(element.id, { checked: !element.checked });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    crdtBridge.deleteElements([element.id]);
    setSelectedIds([]);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    setSelectedIds([element.id]);
    let lastX = e.clientX;
    let lastY = e.clientY;
    dragDistRef.current = 0;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - lastX) / zoom;
      const dy = (moveEv.clientY - lastY) / zoom;
      dragDistRef.current += Math.hypot(moveEv.clientX - lastX, moveEv.clientY - lastY);
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        lastX = moveEv.clientX;
        lastY = moveEv.clientY;
        crdtBridge.shiftElements(dx, dy, [element.id]);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      // If user simply clicked without dragging, toggle check for todo tag
      if (dragDistRef.current < 4 && element.tagType === 'todo') {
        toggleCheck();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedIds([element.id]);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: '#ffffff',
        border: `1.5px solid ${getTagColor()}`,
        borderRadius: '16px',
        padding: '3px 10px',
        boxShadow: isSelected
          ? `0 0 0 2px #2563eb, 0 4px 8px rgba(0,0,0,0.15)`
          : '0 2px 4px rgba(0,0,0,0.08)',
        cursor: 'grab',
        userSelect: 'none',
        position: 'relative',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      <GripHorizontal size={11} color={getTagColor()} style={{ opacity: 0.6 }} />

      {element.tagType === 'todo' ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            toggleCheck();
          }}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          {element.checked ? (
            <CheckSquare size={14} color="#16a34a" />
          ) : (
            <Square size={14} color="#64748b" />
          )}
        </span>
      ) : null}

      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#1e293b',
          textDecoration: element.checked ? 'line-through' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {element.label}
      </span>

      {(isHovered || isSelected) && (
        <button
          onClick={handleDelete}
          title="Delete Tag"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#dc2626',
            padding: '1px',
            marginLeft: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
};
