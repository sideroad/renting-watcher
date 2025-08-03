import crypto from 'crypto';

export function generatePropertyId(title: string, area: string, price: string): string {
  const normalizedTitle = title.trim();
  const normalizedArea = area.trim();
  const normalizedPrice = price.trim();
  
  const combined = `${normalizedTitle}|${normalizedArea}|${normalizedPrice}`;
  return crypto.createHash('sha256').update(combined, 'utf8').digest('hex').substring(0, 16);
}