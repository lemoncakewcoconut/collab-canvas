import React, { useState } from 'react';
import { CanvasElement, TagElement } from '@collabcanvas/shared';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { crdtBridge } from '../../state/crdtBridge.js';
import { X, CheckSquare, AlertCircle, HelpCircle, Lightbulb, Search } from 'lucide-react';

interface Props {
  elements: CanvasElement[];
}

export const TagDrawer: React.FC<Props> = ({ elements }) => {
  const { setActiveDrawer, setPan, zoom } = useCanvasStore();
  const [filter, setFilter] = useState<'all' | 'todo' | 'important' | 'question' | 'idea'>('all');

  const tags = elements.filter((e) => e.type === 'tag') as TagElement[];
  const filteredTags = filter === 'all' ? tags : tags.filter((t) => t.tagType === filter);

  const jumpToElement = (el: TagElement) => {
    // Center viewport on tag
    const centerX = window.innerWidth / 2 - el.x * zoom;
    const centerY = window.innerHeight / 2 - el.y * zoom;
    setPan(centerX, centerY);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '320px',
        height: '100%',
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        boxShadow: '-4px 0 10px rgba(0,0,0,0.06)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} color="#2563EB" />
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Tag Summary ({tags.length})</h3>
        </div>
        <button
          onClick={() => setActiveDrawer(null)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '4px', padding: '8px 16px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
        {(['all', 'todo', 'important', 'question', 'idea'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '3px 8px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '11px',
              cursor: 'pointer',
              background: filter === f ? '#2563EB' : '#f1f5f9',
              color: filter === f ? '#fff' : '#64748b',
              fontWeight: 500,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Tag List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredTags.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '40px' }}>
            No tags found in this room.
          </div>
        ) : (
          filteredTags.map((tag) => (
            <div
              key={tag.id}
              onClick={() => jumpToElement(tag)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {tag.tagType === 'todo' && <CheckSquare size={14} color="#16a34a" />}
                {tag.tagType === 'important' && <AlertCircle size={14} color="#dc2626" />}
                {tag.tagType === 'question' && <HelpCircle size={14} color="#2563eb" />}
                {tag.tagType === 'idea' && <Lightbulb size={14} color="#ca8a04" />}
                <span
                  style={{
                    fontSize: '13px',
                    color: '#1e293b',
                    textDecoration: tag.checked ? 'line-through' : 'none',
                  }}
                >
                  {tag.label}
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Jump &gt;</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
