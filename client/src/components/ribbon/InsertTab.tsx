import React, { useRef, useState } from 'react';
import {
  Table,
  Image as ImageIcon,
  Paperclip,
  Mic,
  SquareRadical,
  StickyNote,
  Smile,
  Upload,
} from 'lucide-react';
import { useCanvasStore } from '../../state/useCanvasStore.js';
import { crdtBridge } from '../../state/crdtBridge.js';
import { uploadFileResumable } from '../../services/uploadService.js';
import { STICKY_COLORS } from '@collabcanvas/shared';

export const InsertTab: React.FC = () => {
  const { setActiveTool } = useCanvasStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Insert Table
  const handleInsertTable = (rows = 3, cols = 3) => {
    const id = `table-${Date.now()}`;
    const zIndex = crdtBridge.getHighestZIndex();

    const cellData: Record<string, { text: string; bg?: string }> = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cellData[`${r},${c}`] = {
          text: r === 0 ? `Header ${c + 1}` : `Row ${r} Col ${c}`,
          bg: r === 0 ? '#f1f5f9' : '#ffffff',
        };
      }
    }

    crdtBridge.addElement({
      id,
      type: 'table',
      x: 300,
      y: 200,
      rows,
      cols,
      cellData,
      cellWidths: Array(cols).fill(120),
      cellHeights: Array(rows).fill(40),
      zIndex,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  // Insert Sticky Note
  const handleInsertSticky = (color = '#FEF08A') => {
    const id = `sticky-${Date.now()}`;
    const zIndex = crdtBridge.getHighestZIndex();
    crdtBridge.addElement({
      id,
      type: 'sticky',
      x: 350,
      y: 250,
      width: 200,
      height: 180,
      text: 'New Note',
      color,
      fontSize: 16,
      zIndex,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  // Insert Equation
  const handleInsertEquation = () => {
    const id = `eq-${Date.now()}`;
    const zIndex = crdtBridge.getHighestZIndex();
    crdtBridge.addElement({
      id,
      type: 'equation',
      x: 350,
      y: 250,
      width: 220,
      height: 60,
      latex: 'f(x) = \\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
      zIndex,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  // Upload Picture / Attachment via 25 MB chunked uploader
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus(`Uploading ${file.name} (0%)...`);
      const result = await uploadFileResumable(file, (progress) => {
        setUploadStatus(`Uploading ${file.name} (${progress.percentage}%)...`);
      });

      const id = `media-${Date.now()}`;
      const zIndex = crdtBridge.getHighestZIndex();

      crdtBridge.addElement({
        id,
        type: 'media',
        x: 300,
        y: 200,
        width: 320,
        height: 240,
        assetId: result.assetId,
        mimeType: result.mimeType,
        fileName: result.fileName,
        fileSize: result.fileSize,
        zIndex,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setUploadStatus(null);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
      setUploadStatus(null);
    }
  };

  // Audio Recording (In-browser MediaRecorder)
  const toggleAudioRecording = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

          setUploadStatus('Saving voice recording...');
          try {
            const result = await uploadFileResumable(audioFile);
            const id = `audio-${Date.now()}`;
            const zIndex = crdtBridge.getHighestZIndex();

            crdtBridge.addElement({
              id,
              type: 'audio',
              x: 300,
              y: 200,
              width: 260,
              height: 64,
              assetId: result.assetId,
              duration: 0,
              fileName: result.fileName,
              zIndex,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          } catch (err: any) {
            alert(`Voice save failed: ${err.message}`);
          }
          setUploadStatus(null);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err: any) {
        alert(`Microphone access failed: ${err.message}`);
      }
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '4px 8px' }}>
      {/* Table Insert */}
      <button
        onClick={() => handleInsertTable(3, 3)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          background: '#fff',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        <Table size={16} color="#2563EB" /> Table (3×3)
      </button>

      {/* Picture Upload */}
      <button
        onClick={() => mediaInputRef.current?.click()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          background: '#fff',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        <ImageIcon size={16} color="#16A34A" /> Picture
      </button>
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* File Attachment (25 MB Resumable) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          background: '#fff',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        <Paperclip size={16} color="#EA580C" /> File Attachment
      </button>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Voice Audio Recording */}
      <button
        onClick={toggleAudioRecording}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          border: isRecording ? '1px solid #DC2626' : '1px solid #cbd5e1',
          borderRadius: '6px',
          background: isRecording ? '#FEF2F2' : '#fff',
          color: isRecording ? '#DC2626' : 'inherit',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        <Mic size={16} className={isRecording ? 'animate-ping' : ''} />
        {isRecording ? 'Stop Recording' : 'Record Audio'}
      </button>

      {/* Equation Editor */}
      <button
        onClick={handleInsertEquation}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          background: '#fff',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        <SquareRadical size={16} color="#9333EA" /> Equation
      </button>

      {/* Miro Sticky Notes Palette */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        <span style={{ fontSize: '12px', color: '#64748b' }}>Sticky:</span>
        {STICKY_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => handleInsertSticky(color)}
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: color,
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {uploadStatus && (
        <span style={{ fontSize: '12px', color: '#2563EB', fontWeight: 500, marginLeft: 'auto' }}>
          {uploadStatus}
        </span>
      )}
    </div>
  );
};
