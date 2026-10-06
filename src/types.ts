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
  /** 施工写真のセクション（敷地現況写真、基礎配筋写真など）。自由入力も可。 */
  status: string;
  /** 自由記入のメモ */
  memo: string;
  /** 撮影日 (YYYY-MM-DD)。EXIFから取得、無ければファイルの更新日時。 */
  takenAt: string;
  addedAt: string;
  /** 同じ物件・ステータス内での並び順（小さいほど先）。ドラッグ&ドロップで並び替え可能。 */
  order: number;
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

export type HistoryAction =
  | 'import'
  | 'edit'
  | 'delete'
  | 'reorder'
  | 'property_create'
  | 'property_rename'
  | 'property_delete'
  | 'export_pdf';

export interface HistoryEntry {
  id: string;
  /** ISO日時 */
  timestamp: string;
  /** 担当者名（未設定の場合は「未設定」） */
  actor: string;
  action: HistoryAction;
  /** 画面に表示する内容の説明文 */
  summary: string;
  propertyId?: string;
}
