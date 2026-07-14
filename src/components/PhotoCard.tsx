import { useState } from 'react';
import type { Photo, Property } from '../types';
import { useObjectUrl } from '../hooks/useObjectUrl';

interface Props {
  photo: Photo;
  properties: Property[];
  onChange: (photo: Photo) => void;
  onDelete: (id: string) => void;
}

export function PhotoCard({ photo, properties, onChange, onDelete }: Props) {
  const url = useObjectUrl(photo.displayBlob);
  const [description, setDescription] = useState(photo.description);

  const commitDescription = () => {
    if (description !== photo.description) {
      onChange({ ...photo, description });
    }
  };

  return (
    <div className="photo-card">
      <div className="photo-card-image">
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
