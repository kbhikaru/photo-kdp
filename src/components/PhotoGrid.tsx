import type { Photo, Property } from '../types';
import { PhotoCard } from './PhotoCard';
import { STATUS_DATALIST_ID, STATUS_OPTIONS, UNSET_STATUS_LABEL, statusSortKey } from '../lib/statusOptions';

interface Props {
  photos: Photo[];
  properties: Property[];
  onChangePhoto: (photo: Photo) => void;
  onDeletePhoto: (id: string) => void;
}

export function PhotoGrid({ photos, properties, onChangePhoto, onDeletePhoto }: Props) {
  if (photos.length === 0) {
    return (
      <>
        <StatusDatalist />
        <p className="empty-state">写真がありません。上のエリアにドラッグ&ドロップしてください。</p>
      </>
    );
  }

  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));
  const propertyGroups = groupBy(photos, (p) => p.propertyId);
  const sortedPropertyIds = [...propertyGroups.keys()].sort((a, b) =>
    (propertyNameById.get(a) ?? '').localeCompare(propertyNameById.get(b) ?? '', 'ja'),
  );

  return (
    <div className="photo-groups">
      <StatusDatalist />
      {sortedPropertyIds.map((propertyId) => {
        const propertyPhotos = propertyGroups.get(propertyId) ?? [];
        const statusGroups = groupBy(propertyPhotos, (p) => p.status || '');
        const sortedStatusKeys = [...statusGroups.keys()].sort(
          (a, b) => statusSortKey(a) - statusSortKey(b) || a.localeCompare(b, 'ja'),
        );

        return (
          <section key={propertyId} className="photo-group">
            <h2 className="photo-group-title">
              {propertyNameById.get(propertyId) ?? '未分類'}
              <span className="photo-group-count">{propertyPhotos.length}枚</span>
            </h2>
            {sortedStatusKeys.map((status) => {
              const list = [...(statusGroups.get(status) ?? [])].sort((a, b) =>
                a.takenAt.localeCompare(b.takenAt),
              );
              return (
                <div key={status || '(none)'} className="status-group">
                  <h3 className="status-group-title">
                    {status || UNSET_STATUS_LABEL}
                    <span className="photo-group-count">{list.length}枚</span>
                  </h3>
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
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function StatusDatalist() {
  return (
    <datalist id={STATUS_DATALIST_ID}>
      {STATUS_OPTIONS.map((status) => (
        <option key={status} value={status} />
      ))}
    </datalist>
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
