import React, { useEffect, useState } from 'react';
import { useCanvasStore } from './state/useCanvasStore.js';
import { crdtBridge } from './state/crdtBridge.js';
import { Canvas } from './components/Canvas.js';
import { OneNoteRibbon } from './components/ribbon/OneNoteRibbon.js';
import { TagDrawer } from './components/modals/TagDrawer.js';
import { HistoryModal } from './components/modals/HistoryModal.js';
import { InkReplayModal } from './components/modals/InkReplayModal.js';
import { PasswordModal } from './components/modals/PasswordModal.js';
import { CanvasElement } from '@collabcanvas/shared';

export const App: React.FC = () => {
  const {
    roomId,
    setRoomInfo,
    hasPassword,
    isPasswordUnlocked,
    setIsPasswordUnlocked,
    activeDrawer,
    isDarkMode,
  } = useCanvasStore();

  const [elements, setElements] = useState<CanvasElement[]>([]);

  useEffect(() => {
    // Parse room ID from URL hash or query, e.g. #room=main or ?room=main
    const hash = window.location.hash;
    const match = hash.match(/room=([a-zA-Z0-9_-]+)/);
    const targetRoom = match ? match[1] : 'default';

    // Fetch room metadata
    fetch(`/api/rooms/${targetRoom}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.room) {
          setRoomInfo(data.room);

          if (data.room.hasPassword) {
            const token = localStorage.getItem(`collab_token_${targetRoom}`);
            if (token) {
              setIsPasswordUnlocked(true);
              crdtBridge.connect(targetRoom, token);
            }
          } else {
            crdtBridge.connect(targetRoom);
          }
        } else {
          // If room doesn't exist yet, connect default
          crdtBridge.connect(targetRoom);
        }
      })
      .catch(() => {
        crdtBridge.connect(targetRoom);
      });

    const unsub = crdtBridge.subscribe(() => {
      setElements(crdtBridge.getAllElements());
    });

    return () => {
      unsub();
      crdtBridge.disconnect();
    };
  }, []);

  return (
    <div
      className={isDarkMode ? 'dark' : ''}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        background: isDarkMode ? '#0f172a' : '#f8fafc',
      }}
    >
      {/* MS OneNote Fluent Ribbon */}
      <OneNoteRibbon />

      {/* Infinite Canvas */}
      <Canvas />

      {/* Drawers and Modals */}
      {activeDrawer === 'tags' && <TagDrawer elements={elements} />}
      {activeDrawer === 'history' && <HistoryModal />}
      {activeDrawer === 'replay' && <InkReplayModal elements={elements} />}
      {hasPassword && !isPasswordUnlocked && <PasswordModal />}
    </div>
  );
};
