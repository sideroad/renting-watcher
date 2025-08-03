/**
 * 住所を丁目レベルまで正規化する
 * @param address - 正規化する住所
 * @returns 丁目レベルまで正規化された住所
 * 
 * @example
 * normalizeAddress('東京都立川市柴崎町２丁目2-3ハイツ101号室') // => '東京都立川市柴崎町２丁目'
 * normalizeAddress('世田谷区三軒茶屋2-1-1') // => '世田谷区三軒茶屋2丁目'
 */
const normalizeAddress = (address: string): string => {
  if (!address) return '';
  
  // 丁目レベルまでに正規化（建物名・部屋番号除去）
  // パターン1: 既に丁目がある場合（東京都立川市柴崎町２丁目...）
  const chomeMatch = address.match(/(.*?[０-９0-9]+丁目)/);
  if (chomeMatch) {
    // 半角数字を全角数字に変換して統一
    return chomeMatch[1].replace(/[0-9]/g, match => String.fromCharCode(match.charCodeAt(0) + 0xFEE0));
  }
  
  // パターン2: 数字だけの場合（世田谷区三軒茶屋2-1-1 → 世田谷区三軒茶屋2丁目）
  // ハイフンやダッシュを含む番地部分を除去
  const numberMatch = address.match(/(.*?)([０-９0-9]+)(?:[-－−][０-９0-9]+)*$/);
  if (numberMatch) {
    // 半角数字を全角数字に変換
    const fullWidthNumber = numberMatch[2].replace(/[0-9]/g, match => String.fromCharCode(match.charCodeAt(0) + 0xFEE0));
    return numberMatch[1] + fullWidthNumber + '丁目';
  }
  
  return address;
}

/**
 * 全角数字を半角数字に変換する
 * @param str - 変換する文字列
 * @returns 半角数字に変換された文字列
 */
const convertFullWidthToHalfWidth = (str: string): string => {
  return str.replace(/[０-９]/g, match => String.fromCharCode(match.charCodeAt(0) - 0xFEE0));
}

/**
 * 住所文字列をクリーンアップする
 * @param address - クリーンアップする住所
 * @returns クリーンアップされた住所
 */
const cleanupAddress = (address: string): string => {
  return address
    .replace(/\s+/g, '')  // 空白削除
    .replace(/[\u3000]/g, '')   // 全角空白削除
    .replace(/[０-９]/g, match => String.fromCharCode(match.charCodeAt(0) - 0xFEE0))  // 全角数字を半角に
    .replace(/[－−]/g, '-')  // 全角ハイフンを半角に
    .split(/[、。]/)[0];  // 句読点で分割して最初の部分を取得
}

export { normalizeAddress, convertFullWidthToHalfWidth, cleanupAddress };