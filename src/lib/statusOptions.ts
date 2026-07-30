/** 工事写真のステータス（セクション）。この順番どおりに台帳へ反映される。 */
export const STATUS_OPTIONS = [
  '敷地現況写真',
  '基礎配筋写真',
  '床断熱材写真',
  '垂木留め写真',
  '小屋組写真',
  '屋根写真',
  '軸組前景写真',
  '防蟻写真',
  '金物写真',
  '透湿防水シート写真',
  'サッシ写真',
  '断熱材写真',
  'バルコニー防水写真',
  '是正写真',
] as const;

export const STATUS_DATALIST_ID = 'photo-status-options';

export const UNSET_STATUS_LABEL = '未設定';

/** 決まったステータス順 → 自由入力したステータス → 未設定、の順に並べるための並び順キー。 */
export function statusSortKey(status: string): number {
  if (!status) return STATUS_OPTIONS.length + 1;
  const index = STATUS_OPTIONS.indexOf(status as (typeof STATUS_OPTIONS)[number]);
  return index === -1 ? STATUS_OPTIONS.length : index;
}
