import { jsPDF } from 'jspdf';
import type { Photo, Property } from '../types';
import { UNSET_STATUS_LABEL, statusSortKey } from './statusOptions';

const PAGE_W = 210; // A4 mm
const MARGIN = 12;
const COLS = 2;
const ROWS = 3;
const GAP = 6;
const HEADER_H = 16;
const CAPTION_H = 12;

const CELL_W = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
const PHOTO_H = CELL_W * 0.75; // 4:3固定
const CELL_H = PHOTO_H + CAPTION_H;

const RENDER_DPI = 150;

/**
 * 物件ごと・ステータス（施工セクション）ごとにグループ化する。
 * ステータスは指定の工程順に並び、写真は撮影日順、1ページあたり最大6枚で自動改ページする。
 * セクションが変わるたびに新しいページから始める。
 */
export async function exportLedgerPdf(photos: Photo[], properties: Property[]): Promise<Blob> {
  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));
  const propertyGroups = groupBy(photos, (p) => p.propertyId);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let isFirstPage = true;
  const perPage = COLS * ROWS;

  const sortedPropertyIds = [...propertyGroups.keys()].sort((a, b) =>
    (propertyNameById.get(a) ?? '').localeCompare(propertyNameById.get(b) ?? '', 'ja'),
  );

  for (const propertyId of sortedPropertyIds) {
    const propertyName = propertyNameById.get(propertyId) ?? '未分類';
    const statusGroups = groupBy(propertyGroups.get(propertyId) ?? [], (p) => p.status || '');
    const sortedStatusKeys = [...statusGroups.keys()].sort(
      (a, b) => statusSortKey(a) - statusSortKey(b) || a.localeCompare(b, 'ja'),
    );

    for (const status of sortedStatusKeys) {
      const sorted = [...(statusGroups.get(status) ?? [])].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
      const pageCount = Math.max(1, Math.ceil(sorted.length / perPage));
      const sectionTitle = `${propertyName} ${status || UNSET_STATUS_LABEL}`;

      for (let page = 0; page < pageCount; page++) {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        drawHeader(doc, sectionTitle, page + 1, pageCount);

        const pagePhotos = sorted.slice(page * perPage, (page + 1) * perPage);
        for (let i = 0; i < pagePhotos.length; i++) {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const x = MARGIN + col * (CELL_W + GAP);
          const y = MARGIN + HEADER_H + row * (CELL_H + GAP);
          await drawPhotoCell(doc, pagePhotos[i], x, y);
        }
      }
    }
  }

  return doc.output('blob');
}

function drawHeader(doc: jsPDF, sectionTitle: string, page: number, pageCount: number): void {
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(`${sectionTitle} 写真台帳`, MARGIN, MARGIN);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`${page} / ${pageCount} ページ`, PAGE_W - MARGIN, MARGIN, { align: 'right' });
  doc.setDrawColor(180);
  doc.line(MARGIN, MARGIN + 3, PAGE_W - MARGIN, MARGIN + 3);
}

async function drawPhotoCell(doc: jsPDF, photo: Photo, x: number, y: number): Promise<void> {
  const dataUrl = await renderFixedSizeJpeg(photo.displayBlob, CELL_W, PHOTO_H);
  doc.addImage(dataUrl, 'JPEG', x, y, CELL_W, PHOTO_H);
  doc.setDrawColor(210);
  doc.rect(x, y, CELL_W, PHOTO_H);

  doc.setFontSize(8);
  doc.setTextColor(40);
  doc.text(`撮影日: ${formatDate(photo.takenAt)}`, x, y + PHOTO_H + 4.5);

  const desc = photo.description || '(説明なし)';
  const wrapped = doc.splitTextToSize(desc, CELL_W) as string[];
  doc.text(wrapped.slice(0, 2), x, y + PHOTO_H + 8.5);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${y}/${m}/${d}` : iso;
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

/** 写真の大きさを固定するため、余白部分を中央基準でトリミングしてリサイズする。 */
function renderFixedSizeJpeg(blob: Blob, targetWmm: number, targetHmm: number): Promise<string> {
  const mmToPx = (mm: number) => Math.round((mm / 25.4) * RENDER_DPI);
  const w = mmToPx(targetWmm);
  const h = mmToPx(targetHmm);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas 2d context is not available'));
        return;
      }
      const scale = Math.max(w / img.width, h / img.height);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像の読み込みに失敗しました'));
    };
    img.src = url;
  });
}

export function downloadPdf(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
