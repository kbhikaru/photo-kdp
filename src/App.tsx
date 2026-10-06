import { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { DroppedFile, HistoryEntry, Photo, Property } from './types';
import {
  deletePhotoRecord,
  deletePropertyRecord,
  getAllPhotos,
  getAllProperties,
  savePhoto,
  saveProperty,
} from './lib/db';
import {
  connectDriveFolder,
  getConnectedDriveFolder,
  isFileSystemAccessSupported,
  saveOriginalToFolder,
} from './lib/driveFolder';
import { buildPhoto, mapWithConcurrency, resolvePropertyForFolder } from './lib/importPipeline';
import { filterPhotos } from './lib/search';
import { downloadPdf, exportLedgerPdf, type PdfFormat } from './lib/pdfExport';
import { exportOriginalsAsZip } from './lib/zipExport';
import { getActorName, listHistory, recordHistory, setActorName } from './lib/history';
import { Dropzone } from './components/Dropzone';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { PhotoGrid } from './components/PhotoGrid';
import { HistoryPanel } from './components/HistoryPanel';
import './App.css';

const LAST_PROPERTY_KEY = 'photo-ledger:last-property-id';

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [driveFolder, setDriveFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [exportingPdf, setExportingPdf] = useState(false);
  const [actorName, setActorNameState] = useState('');
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[] | null>(null);

  const driveSupported = useMemo(() => isFileSystemAccessSupported(), []);

  useEffect(() => {
    (async () => {
      const [loadedPhotos, loadedProperties, savedActorName] = await Promise.all([
        getAllPhotos(),
        getAllProperties(),
        getActorName(),
      ]);
      setPhotos(loadedPhotos);
      setProperties(loadedProperties);
      setActorNameState(savedActorName);

      const lastId = localStorage.getItem(LAST_PROPERTY_KEY);
      if (lastId && loadedProperties.some((p) => p.id === lastId)) {
        setSelectedPropertyId(lastId);
      }

      const handle = await getConnectedDriveFolder();
      setDriveFolder(handle);
      setLoaded(true);
    })();
  }, []);

  const handleChangeActorName = async () => {
    const next = window.prompt('担当者名を入力してください', actorName);
    if (next === null) return;
    const trimmed = next.trim();
    setActorNameState(trimmed);
    await setActorName(trimmed);
  };

  const openHistory = async () => {
    setHistoryEntries(await listHistory());
  };

  const selectProperty = (id: string | null) => {
    setSelectedPropertyId(id);
    localStorage.setItem(LAST_PROPERTY_KEY, id ?? '');
  };

  const handleFiles = async (dropped: DroppedFile[]) => {
    if (dropped.length === 0) return;
    setImporting(true);
    setImportProgress({ done: 0, total: dropped.length });

    try {
      let workingProperties = [...properties];
      const newProperties: Property[] = [];
      const propertyForIndex: Property[] = [];

      for (const item of dropped) {
        const { property, isNew } = resolvePropertyForFolder(workingProperties, selectedPropertyId, item.topFolder);
        if (isNew) {
          workingProperties = [...workingProperties, property];
          newProperties.push(property);
        }
        propertyForIndex.push(property);
      }

      if (newProperties.length > 0) {
        setProperties(workingProperties);
        await Promise.all(newProperties.map((p) => saveProperty(p)));
      }

      const propertyNameById = new Map(workingProperties.map((p) => [p.id, p.name]));
      let done = 0;

      const newPhotos = await mapWithConcurrency(dropped, 3, async (item, index) => {
        const photo = await buildPhoto(item, propertyForIndex[index].id, index);

        if (driveFolder) {
          try {
            const propertyName = propertyNameById.get(photo.propertyId) ?? '未分類';
            await saveOriginalToFolder(driveFolder, propertyName, photo.fileName, photo.originalBlob);
            photo.savedToFolder = true;
          } catch (err) {
            console.error('元写真をドライブフォルダに保存できませんでした', err);
          }
        }

        done += 1;
        setImportProgress({ done, total: dropped.length });
        return photo;
      });

      await Promise.all(newPhotos.map((p) => savePhoto(p)));
      setPhotos((prev) => [...prev, ...newPhotos]);

      const countByNewPropertyId = new Map<string, number>();
      for (const photo of newPhotos) {
        countByNewPropertyId.set(photo.propertyId, (countByNewPropertyId.get(photo.propertyId) ?? 0) + 1);
      }
      for (const [propertyId, count] of countByNewPropertyId) {
        await recordHistory(actorName, 'import', `写真を${count}枚取り込みました`, propertyId);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleChangePhoto = (updated: Photo) => {
    const before = photos.find((p) => p.id === updated.id);
    setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    void savePhoto(updated);
    if (before) {
      const summary = describePhotoChange(before, updated);
      if (summary) void recordHistory(actorName, 'edit', summary, updated.propertyId);
    }
  };

  const handleReorderPhotos = (updated: Photo[]) => {
    const updatedById = new Map(updated.map((p) => [p.id, p]));
    setPhotos((prev) => prev.map((p) => updatedById.get(p.id) ?? p));
    updated.forEach((p) => void savePhoto(p));
    if (updated.length > 0) {
      void recordHistory(actorName, 'reorder', '写真の並び替えを行いました', updated[0].propertyId);
    }
  };

  const handleDeletePhoto = (id: string) => {
    const target = photos.find((p) => p.id === id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    void deletePhotoRecord(id);
    if (target) {
      void recordHistory(actorName, 'delete', `写真を削除しました：${target.fileName}`, target.propertyId);
    }
  };

  const handleCreateProperty = (name: string) => {
    const property: Property = { id: uuid(), name, createdAt: new Date().toISOString() };
    setProperties((prev) => [...prev, property]);
    selectProperty(property.id);
    void saveProperty(property);
    void recordHistory(actorName, 'property_create', `物件を追加しました：${name}`, property.id);
  };

  const handleRenameProperty = (id: string, name: string) => {
    const property = properties.find((p) => p.id === id);
    if (!property) return;
    const updated = { ...property, name };
    setProperties((prev) => prev.map((p) => (p.id === id ? updated : p)));
    void saveProperty(updated);
    void recordHistory(actorName, 'property_rename', `物件名を変更しました：${property.name} → ${name}`, id);
  };

  const handleDeleteProperty = (id: string) => {
    const property = properties.find((p) => p.id === id);
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setPhotos((prev) => prev.filter((p) => p.propertyId !== id));
    if (selectedPropertyId === id) selectProperty(null);
    void deletePropertyRecord(id);
    if (property) {
      void recordHistory(actorName, 'property_delete', `物件を削除しました：${property.name}`, id);
    }
  };

  const handleConnectDrive = async () => {
    try {
      const handle = await connectDriveFolder();
      setDriveFolder(handle);
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        console.error('ドライブフォルダへの接続に失敗しました', err);
        window.alert('フォルダへの接続に失敗しました。もう一度お試しください。');
      }
    }
  };

  const exportTargetPhotos = useMemo(
    () => (selectedPropertyId ? photos.filter((p) => p.propertyId === selectedPropertyId) : photos),
    [photos, selectedPropertyId],
  );

  const handleExportPdf = async (format: PdfFormat) => {
    if (exportTargetPhotos.length === 0) return;
    setExportingPdf(true);
    try {
      const blob = await exportLedgerPdf(exportTargetPhotos, properties, format);
      const formatLabel = format === 'imagesOnly' ? '画像のみ' : '詳細';
      downloadPdf(blob, `写真台帳_${formatLabel}_${todayStamp()}.pdf`);
      await recordHistory(
        actorName,
        'export_pdf',
        `台帳PDFを出力しました（${formatLabel}・${exportTargetPhotos.length}枚）`,
        selectedPropertyId ?? undefined,
      );
    } catch (err) {
      console.error('PDFの作成に失敗しました', err);
      window.alert('PDFの作成に失敗しました。');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportZip = async () => {
    if (exportTargetPhotos.length === 0) return;
    await exportOriginalsAsZip(exportTargetPhotos, properties);
  };

  const filteredPhotos = useMemo(() => {
    const byQuery = filterPhotos(photos, properties, query);
    return selectedPropertyId ? byQuery.filter((p) => p.propertyId === selectedPropertyId) : byQuery;
  }, [photos, properties, query, selectedPropertyId]);

  const countByProperty = useMemo(() => {
    const map = new Map<string, number>();
    for (const photo of photos) {
      map.set(photo.propertyId, (map.get(photo.propertyId) ?? 0) + 1);
    }
    return map;
  }, [photos]);

  const propertyNameById = useMemo(() => new Map(properties.map((p) => [p.id, p.name])), [properties]);

  if (!loaded) {
    return (
      <div className="app-loading">
        <p>読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>写真台帳</h1>
          <p className="app-subtitle">工事写真をドラッグ&ドロップして、物件ごとの台帳PDFを作成します</p>
        </div>
        <div className="app-header-actions">
          <button type="button" className="actor-name-btn" onClick={handleChangeActorName}>
            担当者: {actorName || '未設定'}
          </button>
          <button type="button" onClick={openHistory}>
            作成履歴
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <PropertyPanel
            properties={properties}
            countByProperty={countByProperty}
            selectedPropertyId={selectedPropertyId}
            onSelect={selectProperty}
            onCreate={handleCreateProperty}
            onRename={handleRenameProperty}
            onDelete={handleDeleteProperty}
          />
        </aside>

        <main className="main">
          <Dropzone
            onFiles={handleFiles}
            busy={importing}
            busyLabel={`取り込み中… (${importProgress.done}/${importProgress.total})`}
          />

          <Toolbar
            query={query}
            onQueryChange={setQuery}
            driveSupported={driveSupported}
            driveConnected={driveFolder !== null}
            onConnectDrive={handleConnectDrive}
            onExportZip={handleExportZip}
            onExportPdf={handleExportPdf}
            exportingPdf={exportingPdf}
            photoCount={exportTargetPhotos.length}
          />

          <PhotoGrid
            photos={filteredPhotos}
            properties={properties}
            onChangePhoto={handleChangePhoto}
            onDeletePhoto={handleDeletePhoto}
            onReorderPhotos={handleReorderPhotos}
          />
        </main>
      </div>

      {historyEntries !== null && (
        <HistoryPanel
          entries={historyEntries}
          propertyNameById={propertyNameById}
          onClose={() => setHistoryEntries(null)}
        />
      )}
    </div>
  );
}

function describePhotoChange(before: Photo, after: Photo): string | null {
  if (before.description !== after.description) {
    return `説明を編集しました：${after.description || '(空欄)'}`;
  }
  if (before.status !== after.status) {
    return `ステータスを変更しました：${after.status || '(未設定)'}`;
  }
  if (before.memo !== after.memo) {
    return 'メモを編集しました';
  }
  if (before.takenAt !== after.takenAt) {
    return `撮影日を変更しました：${after.takenAt}`;
  }
  if (before.propertyId !== after.propertyId) {
    return '写真の物件を変更しました';
  }
  return null;
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
