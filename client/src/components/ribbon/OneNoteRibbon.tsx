import React from 'react';
import {
  Undo2,
  Redo2,
  Users,
  Lock,
  Share2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { crdtBridge } from '../../state/crdtBridge.js';
import { DrawTab } from './DrawTab.js';
import { HomeTab } from './HomeTab.js';
import { InsertTab } from './InsertTab.js';
import { ViewTab } from './ViewTab.js';

export const OneNoteRibbon: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    roomTitle,
    roomId,
    hasPassword,
    isImmersive,
    toggleImmersive,
    username,
    userColor,
  } = useCanvasStore();

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Room link copied to clipboard!');
  };

  if (isImmersive) {
    return (
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          padding: '4px',
          display: 'flex',
          gap: '6px',
        }}
      >
        <button
          onClick={toggleImmersive}
          title="Exit Immersive Mode"
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: '6px',
            background: '#2563EB',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <ChevronDown size={14} /> Show Ribbon
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 50,
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc',
          height: '36px',
        }}
      >
        {/* Undo / Redo & App Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => crdtBridge.undo()}
              title="Undo (Ctrl+Z)"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                color: '#475569',
              }}
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={() => crdtBridge.redo()}
              title="Redo (Ctrl+Y)"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                color: '#475569',
              }}
            >
              <Redo2 size={15} />
            </button>
          </div>

          <div style={{ height: '14px', width: '1px', background: '#cbd5e1' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
              CollabCanvas
            </span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>/ {roomTitle}</span>
            {hasPassword && (
              <span title="Password Protected" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Lock size={12} color="#dc2626" />
              </span>
            )}
          </div>
        </div>

        {/* Right Action Icons: User Badge & Share */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f1f5f9',
              padding: '3px 8px',
              borderRadius: '20px',
              fontSize: '12px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: userColor,
              }}
            />
            <span style={{ fontWeight: 500, color: '#334155' }}>{username}</span>
          </div>

          <button
            onClick={handleShare}
            title="Share Room Link"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <Share2 size={13} /> Share
          </button>

          <button
            onClick={toggleImmersive}
            title="Collapse Ribbon"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#64748b',
            }}
          >
            <ChevronUp size={16} />
          </button>
        </div>
      </div>

      {/* Ribbon Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', paddingLeft: '12px', height: '32px' }}>
        {(['draw', 'home', 'insert', 'view'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0 16px',
                height: '100%',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
                color: isActive ? '#2563EB' : '#64748b',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Toolbar Controls */}
      <div style={{ background: '#ffffff', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
        {activeTab === 'draw' && <DrawTab />}
        {activeTab === 'home' && <HomeTab />}
        {activeTab === 'insert' && <InsertTab />}
        {activeTab === 'view' && <ViewTab />}
      </div>
    </div>
  );
};
