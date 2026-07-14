import { v4 as uuid } from 'uuid';
import type { DroppedFile, Photo, Property } from '../types';
import { isHeic, convertHeicToJpeg } from './heic';
import { extractTakenAt } from './exif';
import { guessDescription } from './fileImport';

const UNCLASSIFIED_NAME = '未分類';

/** ドロップされたフォルダ名から物件を解決する。無ければ新規作成する。 */
export function resolvePropertyForFolder(
  existing: Property[],
  fallbackPropertyId: string | null,
  topFolder: string | null,
): { property: Property; isNew: boolean } {
  if (topFolder) {
    const match = existing.find((p) => p.name.toLowerCase() === topFolder.toLowerCase());
    if (match) return { property: match, isNew: false };
    return {
      property: { id: uuid(), name: topFolder, createdAt: new Date().toISOString() },
      isNew: true,
    };
  }

  const fallback = existing.find((p) => p.id === fallbackPropertyId);
  if (fallback) return { property: fallback, isNew: false };

  // 取り込み先が未選択の場合は「未分類」を使い回す（1回のドロップで重複作成しないよう名前でも照合する）。
  const unclassified = existing.find((p) => p.name === UNCLASSIFIED_NAME);
  if (unclassified) return { property: unclassified, isNew: false };

  return {
    property: { id: uuid(), name: UNCLASSIFIED_NAME, createdAt: new Date().toISOString() },
    isNew: true,
  };
}

export async function buildPhoto(dropped: DroppedFile, propertyId: string): Promise<Photo> {
  const { file } = dropped;

  const [takenAt, displayBlob] = await Promise.all([
    extractTakenAt(file),
    isHeic(file) ? convertHeicToJpeg(file) : Promise.resolve<Blob>(file),
  ]);

  return {
    id: uuid(),
    propertyId,
    fileName: file.name,
    description: guessDescription(file.name),
    takenAt,
    addedAt: new Date().toISOString(),
    originalExt: getExt(file.name),
    originalMimeType: file.type,
    displayBlob,
    originalBlob: file,
    savedToFolder: false,
  };
}

/** 一度に大量の写真をドロップされてもブラウザが固まらないよう、並列数を絞って処理する。 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return results;
}

function getExt(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}
