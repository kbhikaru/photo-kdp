import { useRef, useState, type DragEvent } from 'react';
import type { DroppedFile } from '../types';
import { collectDroppedFiles, collectFileListInput } from '../lib/fileImport';

interface Props {
  onFiles: (files: DroppedFile[]) => void;
  busy: boolean;
  busyLabel: string;
}

export function Dropzone({ onFiles, busy, busyLabel }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = await collectDroppedFiles(e.dataTransfer);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      className={`dropzone${isDragOver ? ' dropzone-active' : ''}${busy ? ' dropzone-busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <p className="dropzone-text">
        写真をここにドラッグ&ドロップ
        <span>フォルダごとドロップすると、フォルダ名が物件名として自動入力されます</span>
      </p>
      <div className="dropzone-buttons">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          写真を選択
        </button>
        <button type="button" onClick={() => folderInputRef.current?.click()} disabled={busy}>
          フォルダを選択
        </button>
      </div>
      {busy && <p className="dropzone-status">{busyLabel}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onFiles(collectFileListInput(e.target.files));
          e.target.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onFiles(collectFileListInput(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}
