import type { HistoryEntry } from '../types';

interface Props {
  entries: HistoryEntry[];
  propertyNameById: Map<string, string>;
  onClose: () => void;
}

const ACTION_LABELS: Record<HistoryEntry['action'], string> = {
  import: '取り込み',
  edit: '編集',
  delete: '削除',
  reorder: '並び替え',
  property_create: '物件追加',
  property_rename: '物件名変更',
  property_delete: '物件削除',
  export_pdf: 'PDF出力',
};

export function HistoryPanel({ entries, propertyNameById, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>作成履歴</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="empty-state">履歴はまだありません。</p>
        ) : (
          <ul className="history-list">
            {entries.map((entry) => (
              <li key={entry.id} className="history-item">
                <span className="history-time">{formatDateTime(entry.timestamp)}</span>
                <span className={`history-action history-action-${entry.action}`}>{ACTION_LABELS[entry.action]}</span>
                <span className="history-actor">{entry.actor}</span>
                <span className="history-summary">
                  {entry.summary}
                  {entry.propertyId && propertyNameById.get(entry.propertyId) && (
                    <span className="history-property">（{propertyNameById.get(entry.propertyId)}）</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
