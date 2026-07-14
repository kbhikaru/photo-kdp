interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  driveSupported: boolean;
  driveConnected: boolean;
  onConnectDrive: () => void;
  onExportZip: () => void;
  onExportPdf: () => void;
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
        <button
          type="button"
          className="btn-primary"
          onClick={onExportPdf}
          disabled={photoCount === 0 || exportingPdf}
        >
          {exportingPdf ? 'PDF作成中…' : '台帳PDFを出力'}
        </button>
      </div>
    </div>
  );
}
