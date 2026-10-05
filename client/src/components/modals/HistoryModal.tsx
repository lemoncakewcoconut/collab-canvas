import React, { useEffect, useState } from 'react';
import { SnapshotMeta } from '@collabcanvas/shared';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { fetchRoomHistory, restoreRoomSnapshot } from '../../services/api.js';
import { X, History, RotateCcw, AlertTriangle } from 'lucide-react';

export const HistoryModal: React.FC = () => {
  const { roomId, setActiveDrawer } = useCanvasStore();
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [roomId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const list = await fetchRoomHistory(roomId);
      setSnapshots(list);
    } catch (err) {
      console.error('Failed to load room history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (timestamp: number) => {
    if (!confirm('Are you sure you want to restore this version? Current canvas state will be replaced.')) {
      return;
    }

    try {
      setRestoring(true);
      const success = await restoreRoomSnapshot(roomId, timestamp);
      if (success) {
        alert('Snapshot restored successfully! Reloading...');
        window.location.reload();
      } else {
        alert('Failed to restore snapshot');
      }
    } catch (err: any) {
      alert(`Error restoring snapshot: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '480px',
          maxHeight: '80vh',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
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
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="#2563EB" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Room Version History</h3>
          </div>
          <button
            onClick={() => setActiveDrawer(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Snapshot list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>Loading versions...</div>
          ) : snapshots.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>
              No snapshots yet. Automatic snapshots are saved every 10 minutes.
            </div>
          ) : (
            snapshots.map((snap) => {
              const date = new Date(snap.timestamp);
              return (
                <div
                  key={snap.fileName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                      {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Version #{snap.version} • {(snap.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                  </div>

                  <button
                    disabled={restoring}
                    onClick={() => handleRestore(snap.timestamp)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#2563EB',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    <RotateCcw size={13} /> Restore
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
