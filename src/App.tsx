import { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { DroppedFile, Photo, Property } from './types';
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
import { downloadPdf, exportLedgerPdf } from './lib/pdfExport';
import { exportOriginalsAsZip } from './lib/zipExport';
import { Dropzone } from './components/Dropzone';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { PhotoGrid } from './components/PhotoGrid';
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

  const driveSupported = useMemo(() => isFileSystemAccessSupported(), []);

  useEffect(() => {
    (async () => {
      const [loadedPhotos, loadedProperties] = await Promise.all([getAllPhotos(), getAllProperties()]);
      setPhotos(loadedPhotos);
      setProperties(loadedProperties);

      const lastId = localStorage.getItem(LAST_PROPERTY_KEY);
      if (lastId && loadedProperties.some((p) => p.id === lastId)) {
        setSelectedPropertyId(lastId);
      }

      const handle = await getConnectedDriveFolder();
      setDriveFolder(handle);
      setLoaded(true);
    })();
  }, []);

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
        const photo = await buildPhoto(item, propertyForIndex[index].id);

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
    } finally {
      setImporting(false);
    }
  };

  const handleChangePhoto = (updated: Photo) => {
    setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    void savePhoto(updated);
  };

  const handleDeletePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    void deletePhotoRecord(id);
  };

  const handleCreateProperty = (name: string) => {
    const property: Property = { id: uuid(), name, createdAt: new Date().toISOString() };
    setProperties((prev) => [...prev, property]);
    selectProperty(property.id);
    void saveProperty(property);
  };

  const handleRenameProperty = (id: string, name: string) => {
    const property = properties.find((p) => p.id === id);
    if (!property) return;
    const updated = { ...property, name };
    setProperties((prev) => prev.map((p) => (p.id === id ? updated : p)));
    void saveProperty(updated);
  };

  const handleDeleteProperty = (id: string) => {
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setPhotos((prev) => prev.filter((p) => p.propertyId !== id));
    if (selectedPropertyId === id) selectProperty(null);
    void deletePropertyRecord(id);
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

  const handleExportPdf = async () => {
    if (exportTargetPhotos.length === 0) return;
    setExportingPdf(true);
    try {
      const blob = await exportLedgerPdf(exportTargetPhotos, properties);
      downloadPdf(blob, `写真台帳_${todayStamp()}.pdf`);
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
          />
        </main>
      </div>
    </div>
  );
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
