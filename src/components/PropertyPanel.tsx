import { useState } from 'react';
import type { Property } from '../types';

interface Props {
  properties: Property[];
  countByProperty: Map<string, number>;
  selectedPropertyId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PropertyPanel({
  properties,
  countByProperty,
  selectedPropertyId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [newName, setNewName] = useState('');

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
  };

  const sorted = [...properties].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  return (
    <div className="property-panel">
      <h3>物件</h3>
      <p className="property-hint">
        写真の取り込み先です。フォルダごとドロップした場合はフォルダ名が優先されます。
      </p>
      <ul className="property-list">
        <li className={selectedPropertyId === null ? 'active' : ''}>
          <button type="button" onClick={() => onSelect(null)}>
            すべて表示
          </button>
        </li>
        {sorted.map((p) => (
          <li key={p.id} className={selectedPropertyId === p.id ? 'active' : ''}>
            <button type="button" onClick={() => onSelect(p.id)}>
              <span className="property-name">{p.name}</span>
              <span className="count">{countByProperty.get(p.id) ?? 0}</span>
            </button>
            <div className="property-item-actions">
              <button
                type="button"
                className="icon-btn"
                title="名前を変更"
                onClick={() => {
                  const name = window.prompt('物件名を変更', p.name);
                  if (name && name.trim()) onRename(p.id, name.trim());
                }}
              >
                ✎
              </button>
              <button
                type="button"
                className="icon-btn"
                title="削除"
                onClick={() => {
                  if (window.confirm(`「${p.name}」を削除しますか？含まれる写真も削除されます。`)) {
                    onDelete(p.id);
                  }
                }}
              >
                🗑
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="property-new">
        <input
          value={newName}
          placeholder="新しい物件名"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitNew();
          }}
        />
        <button type="button" onClick={submitNew}>
          追加
        </button>
      </div>
    </div>
  );
}
