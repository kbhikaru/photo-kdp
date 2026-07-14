import JSZip from 'jszip';
import type { Photo, Property } from '../types';
import { sanitizeFolderName } from './driveFolder';

/**
 * Google Driveの同期フォルダ選択に対応していないブラウザ（Firefox/Safari等）向けの代替手段。
 * 物件名ごとのフォルダ構成でZIPを作り、ダウンロードしてもらってGoogleドライブに手動で入れてもらう。
 */
export async function exportOriginalsAsZip(photos: Photo[], properties: Property[]): Promise<void> {
  const zip = new JSZip();
  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));

  for (const photo of photos) {
    const propertyName = sanitizeFolderName(propertyNameById.get(photo.propertyId) ?? '未分類');
    zip.folder(propertyName)?.file(photo.fileName, photo.originalBlob);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `写真台帳_元写真_${new Date().toISOString().slice(0, 10)}.zip`);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
