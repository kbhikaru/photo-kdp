import { parse } from 'exifr';

/** 撮影日 (EXIF DateTimeOriginal) を取得。無ければファイルの更新日時で代替する。 */
export async function extractTakenAt(file: File): Promise<string> {
  try {
    const exif = await parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
    const date: unknown = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate;
    if (date instanceof Date && !isNaN(date.getTime())) {
      return toDateOnlyISO(date);
    }
  } catch {
    // EXIFが読めない場合はファイルの更新日時にフォールバック
  }
  return toDateOnlyISO(new Date(file.lastModified));
}

function toDateOnlyISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
