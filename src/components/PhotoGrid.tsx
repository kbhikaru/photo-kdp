import type { Photo, Property } from '../types';
import { PhotoCard } from './PhotoCard';

interface Props {
  photos: Photo[];
  properties: Property[];
  onChangePhoto: (photo: Photo) => void;
  onDeletePhoto: (id: string) => void;
}

export function PhotoGrid({ photos, properties, onChangePhoto, onDeletePhoto }: Props) {
  if (photos.length === 0) {
    return <p className="empty-state">写真がありません。上のエリアにドラッグ&ドロップしてください。</p>;
  }

  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));
  const groups = groupBy(photos, (p) => p.propertyId);
  const sortedGroupKeys = [...groups.keys()].sort((a, b) =>
    (propertyNameById.get(a) ?? '').localeCompare(propertyNameById.get(b) ?? '', 'ja'),
  );

  return (
    <div className="photo-groups">
      {sortedGroupKeys.map((propertyId) => {
        const list = [...(groups.get(propertyId) ?? [])].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
        return (
          <section key={propertyId} className="photo-group">
            <h2 className="photo-group-title">
              {propertyNameById.get(propertyId) ?? '未分類'}
              <span className="photo-group-count">{list.length}枚</span>
            </h2>
            <div className="photo-grid">
              {list.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  properties={properties}
                  onChange={onChangePhoto}
                  onDelete={onDeletePhoto}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}
