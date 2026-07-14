import { getSetting, setSetting } from './db';

const HANDLE_KEY = 'driveFolderHandle';

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

async function getStoredDriveFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  return (await getSetting<FileSystemDirectoryHandle>(HANDLE_KEY)) ?? null;
}

/** ページ読み込み時など、ユーザー操作なしで確認できる範囲だけ権限をチェックする。 */
export async function getConnectedDriveFolder(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await getStoredDriveFolderHandle();
  if (!handle) return null;
  const granted = handle.queryPermission ? (await handle.queryPermission({ mode: 'readwrite' })) === 'granted' : true;
  return granted ? handle : null;
}

/**
 * 「大元の写真をドライブに入れる」を、Googleドライブ デスクトップアプリの同期フォルダを
 * ローカルフォルダとして選択してもらう方式で実現する（OAuth設定不要）。
 * ボタンクリック（ユーザー操作）から呼ぶこと。
 */
export async function connectDriveFolder(): Promise<FileSystemDirectoryHandle> {
  const stored = await getStoredDriveFolderHandle();
  if (stored && stored.requestPermission) {
    const granted = (await stored.requestPermission({ mode: 'readwrite' })) === 'granted';
    if (granted) return stored;
  }
  const handle = await window.showDirectoryPicker!({ mode: 'readwrite' });
  await setSetting(HANDLE_KEY, handle);
  return handle;
}

export function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || '未分類';
}

/** 物件名のサブフォルダに元写真を保存する。同名ファイルがあれば連番を付けて重複を避ける。 */
export async function saveOriginalToFolder(
  root: FileSystemDirectoryHandle,
  propertyName: string,
  fileName: string,
  blob: Blob,
): Promise<void> {
  const propertyDir = await root.getDirectoryHandle(sanitizeFolderName(propertyName), { create: true });
  const finalName = await pickAvailableName(propertyDir, fileName);
  const fileHandle = await propertyDir.getFileHandle(finalName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function pickAvailableName(dir: FileSystemDirectoryHandle, fileName: string): Promise<string> {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : '';

  let candidate = fileName;
  let n = 1;
  while (await fileExists(dir, candidate)) {
    candidate = `${base}_${n}${ext}`;
    n += 1;
  }
  return candidate;
}

async function fileExists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}
