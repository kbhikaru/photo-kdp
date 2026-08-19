import { useState } from 'react';
import type { PdfFormat } from '../lib/pdfExport';

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  driveSupported: boolean;
  driveConnected: boolean;
  onConnectDrive: () => void;
  onExportZip: () => void;
  onExportPdf: (format: PdfFormat) => void;
  exportingPdf: boolean;
  photoCount: number;
}

export function Toolbar({
  query,
  onQueryChange,
  driveSupported,
  driveConnected,
  onConnectDrive,
  onExportZip,
  onExportPdf,
  exportingPdf,
  photoCount,
}: Props) {
  const [pdfFormat, setPdfFormat] = useState<PdfFormat>('detailed');

  return (
    <div className="toolbar">
      <input
        className="search-input"
        type="search"
        placeholder="物件名・説明・撮影日で検索"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <div className="toolbar-actions">
        {driveSupported ? (
          <button type="button" className={driveConnected ? 'btn-ok' : ''} onClick={onConnectDrive}>
            {driveConnected ? '✓ ドライブ同期フォルダ接続中' : 'ドライブ同期フォルダを選択'}
          </button>
        ) : (
          <button type="button" onClick={onExportZip} disabled={photoCount === 0}>
            元写真をZIPで保存
          </button>
        )}
        <select
          className="pdf-format-select"
          value={pdfFormat}
          onChange={(e) => setPdfFormat(e.target.value as PdfFormat)}
          aria-label="台帳PDFの出力形式"
        >
          <option value="detailed">詳細あり</option>
          <option value="imagesOnly">画像のみ</option>
        </select>
        <button
          type="button"
          className="btn-primary"
          onClick={() => onExportPdf(pdfFormat)}
          disabled={photoCount === 0 || exportingPdf}
        >
          {exportingPdf ? 'PDF作成中…' : '台帳PDFを出力'}
        </button>
      </div>
    </div>
  );
}
