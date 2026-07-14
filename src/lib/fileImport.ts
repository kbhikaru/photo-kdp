import type { DroppedFile } from '../types';

const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/i;

/** ドラッグ&ドロップされたファイル/フォルダを再帰的に走査し、画像ファイルだけを集める。 */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<DroppedFile[]> {
  const items = Array.from(dataTransfer.items);
  const entries = items
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => entry !== null);

  if (entries.length > 0) {
    const results: DroppedFile[] = [];
    for (const entry of entries) {
      await walkEntry(entry, entry.name, results);
    }
    return results;
  }

  return Array.from(dataTransfer.files)
    .filter((f) => IMAGE_EXT.test(f.name))
    .map((f) => ({ file: f, topFolder: null }));
}

export function collectFileListInput(files: FileList): DroppedFile[] {
  return Array.from(files)
    .filter((f) => IMAGE_EXT.test(f.name))
    .map((f) => {
      const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
      const topFolder = relPath && relPath.includes('/') ? relPath.split('/')[0] : null;
      return { file: f, topFolder };
    });
}

async function walkEntry(entry: FileSystemEntry, topFolder: string, out: DroppedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    if (IMAGE_EXT.test(file.name)) {
      const depth = entry.fullPath.split('/').filter(Boolean).length;
      out.push({ file, topFolder: depth > 1 ? topFolder : null });
    }
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children = await readAllEntries(reader);
    for (const child of children) {
      await walkEntry(child, topFolder, out);
    }
  }
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
        } else {
          all.push(...batch);
          readBatch();
        }
      }, reject);
    };
    readBatch();
  });
}

/** ファイル名から簡易的な説明文の初期値を推測する（例: "01_外壁_南面.jpg" -> "外壁 南面"）。 */
export function guessDescription(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  const withoutLeadingNumber = base.replace(/^[\d_\-.\s]+/, '');
  const spaced = withoutLeadingNumber.replace(/[_-]+/g, ' ').trim();
  return spaced || base;
}
