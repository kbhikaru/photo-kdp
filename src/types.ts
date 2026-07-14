export interface Property {
  id: string;
  name: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  propertyId: string;
  fileName: string;
  description: string;
  /** 撮影日 (YYYY-MM-DD)。EXIFから取得、無ければファイルの更新日時。 */
  takenAt: string;
  addedAt: string;
  originalExt: string;
  originalMimeType: string;
  /** 台帳表示・PDF出力用（HEICはJPEGに変換済み） */
  displayBlob: Blob;
  /** ドライブ保存用の元データ（無加工） */
  originalBlob: Blob;
  savedToFolder: boolean;
}

export interface DroppedFile {
  file: File;
  topFolder: string | null;
}
