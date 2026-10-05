import React, { useState } from 'react';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { authenticateRoom } from '../../services/api.js';
import { Lock, ArrowRight } from 'lucide-react';
import { crdtBridge } from '../../state/crdtBridge.js';

export const PasswordModal: React.FC = () => {
  const { roomId, setIsPasswordUnlocked } = useCanvasStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const res = await authenticateRoom(roomId, password);
      if (res.success && res.token) {
        localStorage.setItem(`collab_token_${roomId}`, res.token);
        setIsPasswordUnlocked(true);
        // Connect CRDT with token
        crdtBridge.connect(roomId, res.token);
      } else {
        setError(res.error || 'Incorrect password');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '360px',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lock size={24} color="#dc2626" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 600 }}>Room is Protected</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Enter the room password to join and edit this canvas.
          </p>
        </div>

        {error && (
          <div
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: '12px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Room password..."
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '14px',
            outline: 'none',
          }}
        />

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '6px',
            border: 'none',
            background: '#2563EB',
            color: '#ffffff',
            fontWeight: 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          {loading ? 'Verifying...' : 'Unlock Room'} <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
};
