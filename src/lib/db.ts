import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { HistoryEntry, Photo, Property } from '../types';

interface LedgerDB extends DBSchema {
  photos: {
    key: string;
    value: Photo;
    indexes: { 'by-property': string };
  };
  properties: {
    key: string;
    value: Property;
  };
  settings: {
    key: string;
    value: unknown;
  };
  history: {
    key: string;
    value: HistoryEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<LedgerDB>> | null = null;

function getDB(): Promise<IDBPDatabase<LedgerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LedgerDB>('photo-ledger', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const photos = db.createObjectStore('photos', { keyPath: 'id' });
          photos.createIndex('by-property', 'propertyId');
          db.createObjectStore('properties', { keyPath: 'id' });
          db.createObjectStore('settings');
        }
        if (oldVersion < 2) {
          db.createObjectStore('history', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllPhotos(): Promise<Photo[]> {
  return (await getDB()).getAll('photos');
}

export async function savePhoto(photo: Photo): Promise<void> {
  await (await getDB()).put('photos', photo);
}

export async function deletePhotoRecord(id: string): Promise<void> {
  await (await getDB()).delete('photos', id);
}

export async function getAllProperties(): Promise<Property[]> {
  return (await getDB()).getAll('properties');
}

export async function saveProperty(property: Property): Promise<void> {
  await (await getDB()).put('properties', property);
}

export async function deletePropertyRecord(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['properties', 'photos'], 'readwrite');
  await tx.objectStore('properties').delete(id);
  const photoStore = tx.objectStore('photos');
  const index = photoStore.index('by-property');
  let cursor = await index.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await getDB()).get('settings', key) as Promise<T | undefined>;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await getDB()).put('settings', value, key);
}

export async function getAllHistoryEntries(): Promise<HistoryEntry[]> {
  return (await getDB()).getAll('history');
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  await (await getDB()).put('history', entry);
}
