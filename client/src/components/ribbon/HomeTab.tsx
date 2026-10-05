import React, { useState } from 'react';
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
          defaultValue="Inter, sans-serif"
          style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
        >
          <option value="Inter, sans-serif">Segoe UI / Inter</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Courier New, monospace">Consolas / Code</option>
          <option value="'Comic Sans MS', cursive">Comic / Casual</option>
        </select>

        <select
          defaultValue={16}
          style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
        >
          <option value={12}>12 pt</option>
          <option value={14}>14 pt</option>
          <option value={16}>16 pt</option>
          <option value={20}>20 pt (H3)</option>
          <option value={28}>28 pt (H2)</option>
          <option value={36}>36 pt (H1)</option>
        </select>

        <div style={{ display: 'flex', gap: '2px' }}>
          <button title="Bold" style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
            <Bold size={14} />
          </button>
          <button title="Italic" style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
            <Italic size={14} />
          </button>
          <button title="Underline" style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
            <Underline size={14} />
          </button>
          <button title="Strikethrough" style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
            <Strikethrough size={14} />
          </button>
        </div>
      </div>

      {/* Paragraph & List alignment */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        <button title="Align Left" style={{ padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
          <AlignLeft size={14} />
        </button>
        <button title="Align Center" style={{ padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
          <AlignCenter size={14} />
        </button>
        <button title="Align Right" style={{ padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
          <AlignRight size={14} />
        </button>
        <button title="Bullet List" style={{ padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
          <List size={14} />
        </button>
        <button title="Numbered List" style={{ padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
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
