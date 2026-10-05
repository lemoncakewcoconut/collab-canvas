import React, { useState, useEffect } from 'react';
import {
  Type,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  CheckSquare,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  Search,
  StickyNote,
  Copy,
  Scissors,
  ClipboardPaste,
  Trash2,
} from 'lucide-react';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { crdtBridge } from '../../state/crdtBridge.js';
import { TagType } from '@collabcanvas/shared';

export const HomeTab: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    selectedIds,
    setSelectedIds,
    setActiveDrawer,
  } = useCanvasStore();

  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  const [elements, setElements] = useState<any[]>([]);

  useEffect(() => {
    setElements(crdtBridge.getAllElements());
    return crdtBridge.subscribe(() => {
      setElements(crdtBridge.getAllElements());
    });
  }, []);

  const selectedTextElements = elements.filter(
    (el) => selectedIds.includes(el.id) && el.type === 'text'
  );
  const primaryText = selectedTextElements[0] || null;

  const handleFontFamilyChange = (fontFamily: string) => {
    document.execCommand('fontName', false, fontFamily);
    for (const el of selectedTextElements) {
      crdtBridge.updateElement(el.id, { fontFamily });
    }
  };

  const handleFontSizeChange = (fontSize: number) => {
    for (const el of selectedTextElements) {
      crdtBridge.updateElement(el.id, { fontSize });
    }
  };

  const handleToggleBold = () => {
    document.execCommand('bold', false);
    const newBold = !primaryText?.bold;
    for (const el of selectedTextElements) {
      crdtBridge.updateElement(el.id, { bold: newBold });
    }
  };

  const handleToggleItalic = () => {
    document.execCommand('italic', false);
    const newItalic = !primaryText?.italic;
    for (const el of selectedTextElements) {
      crdtBridge.updateElement(el.id, { italic: newItalic });
    }
  };

  const handleToggleUnderline = () => {
    document.execCommand('underline', false);
    const newUnderline = !primaryText?.underline;
    for (const el of selectedTextElements) {
      crdtBridge.updateElement(el.id, { underline: newUnderline });
    }
  };

  const handleToggleStrike = () => {
    document.execCommand('strikeThrough', false);
    const newStrike = !primaryText?.strike;
    for (const el of selectedTextElements) {
      crdtBridge.updateElement(el.id, { strike: newStrike });
    }
  };

  const handleAlign = (align: 'left' | 'center' | 'right') => {
    if (align === 'left') document.execCommand('justifyLeft', false);
    if (align === 'center') document.execCommand('justifyCenter', false);
    if (align === 'right') document.execCommand('justifyRight', false);
    for (const el of selectedTextElements) {
      crdtBridge.updateElement(el.id, { align });
    }
  };

  const handleCreateTag = (type: TagType, label: string) => {
    const id = `tag-${Date.now()}`;
    const zIndex = crdtBridge.getHighestZIndex();
    crdtBridge.addElement({
      id,
      type: 'tag',
      tagType: type,
      label,
      checked: false,
      x: 200,
      y: 200,
      zIndex,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setTagDropdownOpen(false);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length > 0) {
      crdtBridge.deleteElements(selectedIds);
      setSelectedIds([]);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '4px 8px' }}>
      {/* Freeform Text & Sticky Activators */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.04)', borderRadius: '8px', padding: '3px' }}>
        <button
          title="Freeform Rich Text Container (Click anywhere on canvas)"
          onClick={() => setActiveTool('text')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            background: activeTool === 'text' ? '#2563EB' : 'transparent',
            color: activeTool === 'text' ? '#fff' : 'inherit',
          }}
        >
          <Type size={16} /> Rich Text
        </button>

        <button
          title="Sticky Note (Click anywhere on canvas)"
          onClick={() => setActiveTool('sticky')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            background: activeTool === 'sticky' ? '#2563EB' : 'transparent',
            color: activeTool === 'sticky' ? '#fff' : 'inherit',
          }}
        >
          <StickyNote size={16} /> Sticky Note
        </button>
      </div>

      {/* Font & Style Quick Formatters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        <select
          value={primaryText?.fontFamily || 'Inter, sans-serif'}
          onChange={(e) => handleFontFamilyChange(e.target.value)}
          title="Font Family"
          style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
        >
          <option value="Inter, sans-serif">Segoe UI / Inter</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Courier New, monospace">Consolas / Code</option>
          <option value="'Comic Sans MS', cursive">Comic / Casual</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
        </select>

        <select
          value={primaryText?.fontSize || 16}
          onChange={(e) => handleFontSizeChange(Number(e.target.value))}
          title="Font Size"
          style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
        >
          <option value={12}>12 pt</option>
          <option value={14}>14 pt</option>
          <option value={16}>16 pt (Normal)</option>
          <option value={20}>20 pt (H3)</option>
          <option value={28}>28 pt (H2)</option>
          <option value={36}>36 pt (H1)</option>
          <option value={48}>48 pt (Title)</option>
        </select>

        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            title="Bold (Ctrl+B)"
            onClick={handleToggleBold}
            style={{
              padding: '4px 8px',
              border: primaryText?.bold ? '1px solid #93c5fd' : '1px solid #cbd5e1',
              borderRadius: '4px',
              background: primaryText?.bold ? '#dbeafe' : '#fff',
              color: primaryText?.bold ? '#2563eb' : 'inherit',
              cursor: 'pointer',
            }}
          >
            <Bold size={14} />
          </button>
          <button
            title="Italic (Ctrl+I)"
            onClick={handleToggleItalic}
            style={{
              padding: '4px 8px',
              border: primaryText?.italic ? '1px solid #93c5fd' : '1px solid #cbd5e1',
              borderRadius: '4px',
              background: primaryText?.italic ? '#dbeafe' : '#fff',
              color: primaryText?.italic ? '#2563eb' : 'inherit',
              cursor: 'pointer',
            }}
          >
            <Italic size={14} />
          </button>
          <button
            title="Underline (Ctrl+U)"
            onClick={handleToggleUnderline}
            style={{
              padding: '4px 8px',
              border: primaryText?.underline ? '1px solid #93c5fd' : '1px solid #cbd5e1',
              borderRadius: '4px',
              background: primaryText?.underline ? '#dbeafe' : '#fff',
              color: primaryText?.underline ? '#2563eb' : 'inherit',
              cursor: 'pointer',
            }}
          >
            <Underline size={14} />
          </button>
          <button
            title="Strikethrough"
            onClick={handleToggleStrike}
            style={{
              padding: '4px 8px',
              border: primaryText?.strike ? '1px solid #93c5fd' : '1px solid #cbd5e1',
              borderRadius: '4px',
              background: primaryText?.strike ? '#dbeafe' : '#fff',
              color: primaryText?.strike ? '#2563eb' : 'inherit',
              cursor: 'pointer',
            }}
          >
            <Strikethrough size={14} />
          </button>
        </div>
      </div>

      {/* Paragraph & List alignment */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        <button
          title="Align Left"
          onClick={() => handleAlign('left')}
          style={{
            padding: '4px 6px',
            border: primaryText?.align === 'left' || !primaryText?.align ? '1px solid #93c5fd' : '1px solid #cbd5e1',
            borderRadius: '4px',
            background: primaryText?.align === 'left' || !primaryText?.align ? '#dbeafe' : '#fff',
            color: primaryText?.align === 'left' || !primaryText?.align ? '#2563eb' : 'inherit',
            cursor: 'pointer',
          }}
        >
          <AlignLeft size={14} />
        </button>
        <button
          title="Align Center"
          onClick={() => handleAlign('center')}
          style={{
            padding: '4px 6px',
            border: primaryText?.align === 'center' ? '1px solid #93c5fd' : '1px solid #cbd5e1',
            borderRadius: '4px',
            background: primaryText?.align === 'center' ? '#dbeafe' : '#fff',
            color: primaryText?.align === 'center' ? '#2563eb' : 'inherit',
            cursor: 'pointer',
          }}
        >
          <AlignCenter size={14} />
        </button>
        <button
          title="Align Right"
          onClick={() => handleAlign('right')}
          style={{
            padding: '4px 6px',
            border: primaryText?.align === 'right' ? '1px solid #93c5fd' : '1px solid #cbd5e1',
            borderRadius: '4px',
            background: primaryText?.align === 'right' ? '#dbeafe' : '#fff',
            color: primaryText?.align === 'right' ? '#2563eb' : 'inherit',
            cursor: 'pointer',
          }}
        >
          <AlignRight size={14} />
        </button>
        <button
          title="Bullet List"
          onClick={() => document.execCommand('insertUnorderedList', false)}
          style={{ padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
        >
          <List size={14} />
        </button>
        <button
          title="Numbered List"
          onClick={() => document.execCommand('insertOrderedList', false)}
          style={{ padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
        >
          <ListOrdered size={14} />
        </button>
      </div>

      {/* OneNote Signature Tags Dropdown */}
      <div style={{ position: 'relative', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        <button
          onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <CheckSquare size={14} color="#16a34a" /> Tags
        </button>

        {tagDropdownOpen && (
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
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 100,
              width: '180px',
            }}
          >
            <button
              onClick={() => handleCreateTag('todo', 'To Do')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
            >
              <CheckSquare size={14} color="#16a34a" /> To-Do Checkbox
            </button>
            <button
              onClick={() => handleCreateTag('important', 'Important')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
            >
              <AlertCircle size={14} color="#dc2626" /> Important
            </button>
            <button
              onClick={() => handleCreateTag('question', 'Question')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
            >
              <HelpCircle size={14} color="#2563eb" /> Question
            </button>
            <button
              onClick={() => handleCreateTag('idea', 'Idea')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
            >
              <Lightbulb size={14} color="#ca8a04" /> Idea
            </button>
          </div>
        )}
      </div>

      {/* Find Tags Drawer */}
      <button
        title="Find Tags Drawer (Search all To-Dos and tagged items)"
        onClick={() => setActiveDrawer('tags')}
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
        <Search size={14} /> Find Tags
      </button>

      {/* Delete / Clipboard */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
          <button
            onClick={handleDeleteSelected}
            title="Delete Selected Elements"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              background: '#fef2f2',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            <Trash2 size={14} /> Delete ({selectedIds.length})
          </button>
        </div>
      )}
    </div>
  );
};
