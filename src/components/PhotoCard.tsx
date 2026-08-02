import { useState } from 'react';
import type { Photo, Property } from '../types';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { STATUS_DATALIST_ID } from '../lib/statusOptions';

interface Props {
  photo: Photo;
  properties: Property[];
  onChange: (photo: Photo) => void;
  onDelete: (id: string) => void;
}

export function PhotoCard({ photo, properties, onChange, onDelete }: Props) {
  const url = useObjectUrl(photo.displayBlob);
  const [description, setDescription] = useState(photo.description);
  const [status, setStatus] = useState(photo.status ?? '');
  const [memo, setMemo] = useState(photo.memo ?? '');

  const commitDescription = () => {
    if (description !== photo.description) {
      onChange({ ...photo, description });
    }
  };

  const commitStatus = () => {
    if (status !== (photo.status ?? '')) {
      onChange({ ...photo, status });
    }
  };

  const commitMemo = () => {
    if (memo !== (photo.memo ?? '')) {
      onChange({ ...photo, memo });
    }
  };

  return (
    <div className="photo-card">
      <div className="photo-card-image">
        <span className="drag-handle" title="ドラッグして並び替え" aria-hidden="true">
          ⠿
        </span>
        {url && <img src={url} alt={photo.description || photo.fileName} loading="lazy" />}
        {photo.savedToFolder && (
          <span className="badge badge-saved" title="ドライブの同期フォルダに保存済み">
            ✓ 保存済
          </span>
        )}
      </div>
      <div className="photo-card-body">
        <input
          className="photo-card-description"
          value={description}
          placeholder="写真の説明"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
        />
        <label className="photo-card-field">
          ステータス（工程）
          <input
            list={STATUS_DATALIST_ID}
            value={status}
            placeholder="例: 敷地現況写真"
            onChange={(e) => setStatus(e.target.value)}
            onBlur={commitStatus}
          />
        </label>
        <div className="photo-card-meta">
          <label>
            撮影日
            <input
              type="date"
              value={photo.takenAt}
              onChange={(e) => onChange({ ...photo, takenAt: e.target.value })}
            />
          </label>
          <label>
            物件
            <select
              value={photo.propertyId}
              onChange={(e) => onChange({ ...photo, propertyId: e.target.value })}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="photo-card-field">
          メモ
          <textarea
            className="photo-card-memo"
            value={memo}
            placeholder="自由メモ"
            rows={2}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={commitMemo}
          />
        </label>
        <div className="photo-card-footer">
          <span className="file-name" title={photo.fileName}>
            {photo.fileName}
          </span>
          <button type="button" className="btn-danger-ghost" onClick={() => onDelete(photo.id)}>
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
