import { jsPDF } from 'jspdf';
import type { Photo, Property } from '../types';
import { statusSortKey } from './statusOptions';

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;

const HEADER_ROW_H = 10;
const HEADER_TABLE_H = HEADER_ROW_H * 3;
const HEADER_LABEL_W = 28;
const HEADER_VALUE_W = (CONTENT_W - HEADER_LABEL_W * 2) / 2;

const ROWS_PER_PAGE = 3;
const BLOCK_GAP = 4;
const BLOCKS_TOP = MARGIN + HEADER_TABLE_H + BLOCK_GAP;
const BLOCK_AREA_H = PAGE_H - BLOCKS_TOP - MARGIN;
const BLOCK_H = (BLOCK_AREA_H - BLOCK_GAP * (ROWS_PER_PAGE - 1)) / ROWS_PER_PAGE;

const PHOTO_W = CONTENT_W * 0.527;
const INFO_W = CONTENT_W - PHOTO_W;
const INFO_ROW_H = 8;
const INFO_LABEL_W = 26;
const INFO_VALUE_W = INFO_W - INFO_LABEL_W;
const INFO_ROWS: Array<{ label: string; field: 'no' | 'place' | 'type' | 'section' }> = [
  { label: 'NO', field: 'no' },
  { label: '工事場所', field: 'place' },
  { label: '工種', field: 'type' },
  { label: '工事箇所', field: 'section' },
];

const RENDER_DPI = 150;

const JP_FONT_NAME = 'IPAGothic';
let jpFontBase64Promise: Promise<string> | null = null;

/** 日本語テキスト表示用のフォント(IPAゴシック)を読み込み、base64化してキャッシュする。 */
function loadJapaneseFontBase64(): Promise<string> {
  if (!jpFontBase64Promise) {
    jpFontBase64Promise = fetch('/fonts/ipag.ttf')
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      );
  }
  return jpFontBase64Promise;
}

/**
 * 物件（工事名）ごとに、社内フォーマット（工事番号/報告日/工事名/会社名/注文者/報告者の
 * ヘッダー表 + 1ページ3枚の写真明細）でPDFを組み立てる。物件が変わるたびに新しいページ・
 * 新しい通し番号(NO)から始める。
 */
export async function exportLedgerPdf(photos: Photo[], properties: Property[]): Promise<Blob> {
  const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));
  const propertyGroups = groupBy(photos, (p) => p.propertyId);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const jpFontBase64 = await loadJapaneseFontBase64();
  doc.addFileToVFS('ipag.ttf', jpFontBase64);
  doc.addFont('ipag.ttf', JP_FONT_NAME, 'normal');
  doc.setFont(JP_FONT_NAME);
  let isFirstPage = true;
  const reportDate = formatDate(new Date().toISOString());

  const sortedPropertyIds = [...propertyGroups.keys()].sort((a, b) =>
    (propertyNameById.get(a) ?? '').localeCompare(propertyNameById.get(b) ?? '', 'ja'),
  );

  for (const propertyId of sortedPropertyIds) {
    const propertyName = propertyNameById.get(propertyId) ?? '未分類';
    const sorted = [...(propertyGroups.get(propertyId) ?? [])].sort(
      (a, b) => statusSortKey(a.status) - statusSortKey(b.status) || a.status.localeCompare(b.status, 'ja') || a.order - b.order,
    );

    const pageCount = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));

    for (let page = 0; page < pageCount; page++) {
      if (!isFirstPage) {
        doc.addPage();
        doc.setFont(JP_FONT_NAME);
      }
      isFirstPage = false;

      drawHeaderTable(doc, propertyName, reportDate);

      const pagePhotos = sorted.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
      for (let i = 0; i < pagePhotos.length; i++) {
        const no = page * ROWS_PER_PAGE + i + 1;
        const y = BLOCKS_TOP + i * (BLOCK_H + BLOCK_GAP);
        await drawPhotoBlock(doc, pagePhotos[i], propertyName, no, MARGIN, y);
      }
    }
  }

  return doc.output('blob');
}

function drawHeaderTable(doc: jsPDF, propertyName: string, reportDate: string): void {
  const rows: Array<[string, string, string, string]> = [
    ['工事番号', '', '報告日', reportDate],
    ['工事名', propertyName, '会社名', ''],
    ['注文者', '', '報告者', ''],
  ];

  doc.setDrawColor(60);
  doc.setLineWidth(0.2);
  doc.setFontSize(9);

  rows.forEach((row, rowIndex) => {
    const y = MARGIN + rowIndex * HEADER_ROW_H;
    const cellXs = [
      MARGIN,
      MARGIN + HEADER_LABEL_W,
      MARGIN + HEADER_LABEL_W + HEADER_VALUE_W,
      MARGIN + HEADER_LABEL_W * 2 + HEADER_VALUE_W,
    ];
    const cellWs = [HEADER_LABEL_W, HEADER_VALUE_W, HEADER_LABEL_W, HEADER_VALUE_W];

    row.forEach((text, cellIndex) => {
      const x = cellXs[cellIndex];
      const w = cellWs[cellIndex];
      doc.rect(x, y, w, HEADER_ROW_H);
      doc.setTextColor(cellIndex % 2 === 0 ? 20 : 40);
      doc.text(text, x + 3, y + HEADER_ROW_H / 2 + 1.2, { maxWidth: w - 5 });
    });
  });
}

async function drawPhotoBlock(
  doc: jsPDF,
  photo: Photo,
  propertyName: string,
  no: number,
  x: number,
  y: number,
): Promise<void> {
  doc.setDrawColor(60);
  doc.setLineWidth(0.2);

  // --- 写真 ---
  const dataUrl = await renderFixedSizeJpeg(photo.displayBlob, PHOTO_W, BLOCK_H);
  doc.addImage(dataUrl, 'JPEG', x, y, PHOTO_W, BLOCK_H);
  doc.rect(x, y, PHOTO_W, BLOCK_H);

  // --- 明細テーブル (NO / 工事場所 / 工種 / 工事箇所) ---
  const infoX = x + PHOTO_W;
  const values: Record<'no' | 'place' | 'type' | 'section', string> = {
    no: String(no),
    place: propertyName,
    type: photo.status || '',
    section: photo.description || '',
  };

  INFO_ROWS.forEach((row, rowIndex) => {
    const rowY = y + rowIndex * INFO_ROW_H;
    doc.rect(infoX, rowY, INFO_LABEL_W, INFO_ROW_H);
    doc.rect(infoX + INFO_LABEL_W, rowY, INFO_VALUE_W, INFO_ROW_H);

    doc.setFontSize(8.5);
    doc.setTextColor(40);
    doc.text(row.label, infoX + 2, rowY + INFO_ROW_H / 2 + 1, { maxWidth: INFO_LABEL_W - 3 });
    doc.setTextColor(20);
    doc.text(values[row.field], infoX + INFO_LABEL_W + 2, rowY + INFO_ROW_H / 2 + 1, {
      maxWidth: INFO_VALUE_W - 4,
    });
  });

  // --- 備考欄（メモ・撮影日） ---
  const notesY = y + INFO_ROW_H * INFO_ROWS.length;
  const notesH = BLOCK_H - INFO_ROW_H * INFO_ROWS.length;
  doc.rect(infoX, notesY, INFO_W, notesH);

  doc.setFontSize(7.5);
  doc.setTextColor(90);
  doc.text(`撮影日: ${formatDate(photo.takenAt)}`, infoX + 2, notesY + 4.5);

  if (photo.memo) {
    doc.setFontSize(8);
    doc.setTextColor(30);
    const wrapped = doc.splitTextToSize(photo.memo, INFO_W - 4) as string[];
    const maxLines = Math.max(0, Math.floor((notesH - 6) / 3.6));
    doc.text(wrapped.slice(0, maxLines), infoX + 2, notesY + 9);
  }
}

function formatDate(iso: string): string {
  if (iso.includes('T')) {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }
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
