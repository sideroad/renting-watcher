import { normalizeAddress, convertFullWidthToHalfWidth, cleanupAddress } from '../address';

describe('normalizeAddress', () => {
  it('should normalize address with 丁目 already present', () => {
    expect(normalizeAddress('東京都立川市柴崎町２丁目2-3ハイツ101号室')).toBe('東京都立川市柴崎町２丁目');
    expect(normalizeAddress('東京都港区赤坂1丁目1-1-503')).toBe('東京都港区赤坂１丁目');
    expect(normalizeAddress('神奈川県横浜市中区山下町３丁目123番地')).toBe('神奈川県横浜市中区山下町３丁目');
  });

  it('should add 丁目 to addresses with only numbers', () => {
    expect(normalizeAddress('世田谷区三軒茶屋2-1-1')).toBe('世田谷区三軒茶屋２丁目');
    expect(normalizeAddress('東京都渋谷区恵比寿3')).toBe('東京都渋谷区恵比寿３丁目');
    expect(normalizeAddress('千葉県市川市行徳駅前１－２－３')).toBe('千葉県市川市行徳駅前１丁目');
  });

  it('should handle full-width numbers', () => {
    expect(normalizeAddress('東京都新宿区西新宿７丁目ビル')).toBe('東京都新宿区西新宿７丁目');
    expect(normalizeAddress('東京都豊島区池袋３－１－１')).toBe('東京都豊島区池袋３丁目');
  });

  it('should return empty string for empty input', () => {
    expect(normalizeAddress('')).toBe('');
  });

  it('should return original address if no pattern matches', () => {
    expect(normalizeAddress('東京都中央区銀座')).toBe('東京都中央区銀座');
    expect(normalizeAddress('神奈川県横浜市')).toBe('神奈川県横浜市');
  });
});

describe('convertFullWidthToHalfWidth', () => {
  it('should convert full-width numbers to half-width', () => {
    expect(convertFullWidthToHalfWidth('０１２３４５６７８９')).toBe('0123456789');
    expect(convertFullWidthToHalfWidth('東京都港区赤坂１丁目')).toBe('東京都港区赤坂1丁目');
  });

  it('should not affect half-width numbers', () => {
    expect(convertFullWidthToHalfWidth('0123456789')).toBe('0123456789');
  });

  it('should handle mixed content', () => {
    expect(convertFullWidthToHalfWidth('新宿３丁目と渋谷2丁目')).toBe('新宿3丁目と渋谷2丁目');
  });
});

describe('cleanupAddress', () => {
  it('should remove spaces and convert numbers', () => {
    expect(cleanupAddress('東京都　港区　赤坂　１丁目')).toBe('東京都港区赤坂1丁目');
    expect(cleanupAddress('東京都 新宿区 西新宿 ７－１－１')).toBe('東京都新宿区西新宿7-1-1');
  });

  it('should split at punctuation', () => {
    expect(cleanupAddress('東京都渋谷区、建物名')).toBe('東京都渋谷区');
    expect(cleanupAddress('千葉県市川市。マンション')).toBe('千葉県市川市');
  });

  it('should handle complex addresses', () => {
    const input = '東京都　立川市　柴崎町　２丁目、ハイツ';
    const expected = '東京都立川市柴崎町2丁目';
    expect(cleanupAddress(input)).toBe(expected);
  });
});