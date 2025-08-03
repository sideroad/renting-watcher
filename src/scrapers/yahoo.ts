import axios from 'axios';
import * as cheerio from 'cheerio';
import { Property } from '../types';
import { generatePropertyId, normalizeAddress } from '../utils';
import { BaseScraper } from './base';

export class YahooRealEstateScraper extends BaseScraper {
  async scrapeUrl(url: string): Promise<Property[]> {
    try {
      const response = await axios.get(url, this.getRequestConfig());
      const $ = cheerio.load(response.data);
      const properties: Property[] = [];

      console.log('Using ListBukken__item selector for Yahoo Real Estate');
      
      // Use the ListBukken__item class selector as suggested by the user
      const propertyElements = $('.ListBukken__item');
      console.log(`Found ${propertyElements.length} Yahoo Real Estate properties with ListBukken__item class`);

      propertyElements.each((_, element) => {
        try {
          const $property = $(element);
          
          // 物件URLを取得
          const detailUrl = $property.find('a').first().attr('href');
          
          const fullUrl = detailUrl ? 
            (detailUrl.startsWith('http') ? detailUrl : `https://realestate.yahoo.co.jp${detailUrl}`) : '';
          
          if (!fullUrl) return;
          
          // 物件の全テキストを取得
          const fullText = $property.text();
          
          // 価格を取得 - Yahoo不動産の形式に対応
          let price = '';
          // パターン1: "24.8万円" のような形式
          let priceMatch = fullText.match(/(\d{1,3}(?:\.\d+)?)\s*万円/);
          if (priceMatch) {
            price = priceMatch[0];
          } else {
            // パターン2: "248,000円" のような形式
            priceMatch = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
            if (priceMatch) {
              price = priceMatch[0];
            }
          }
          
          // 住所を取得
          let address = '';
          const addressMatch = fullText.match(/(東京都|神奈川県|埼玉県|千葉県)[^/\n]*?[区市町村]/);
          if (addressMatch) {
            address = addressMatch[0].trim();
            
            // 丁目レベルまでに正規化
            address = normalizeAddress(address);
          }
          
          // 間取りを取得
          let layout = '';
          const layoutMatch = fullText.match(/\d+[LDKS]+[DKS]*/);
          if (layoutMatch) {
            layout = layoutMatch[0];
          }
          
          // 面積を取得 - Yahoo Real EstateのHTML形式に対応
          let area = '';
          // HTMLから直接面積を抽出（83m<sup>2</sup> の形式）
          const propertyHtml = $property.html() || '';
          const areaHtmlMatch = propertyHtml.match(/(\d+\.?\d*)m<sup>2<\/sup>/);
          if (areaHtmlMatch) {
            area = `${areaHtmlMatch[1]}m²`;
          } else {
            // フォールバック: 通常のテキスト形式
            const areaMatch = fullText.match(/(\d+\.?\d*)\s*m²/);
            if (areaMatch) {
              area = areaMatch[0];
            }
          }
          
          // 画像URLを取得
          let imageUrl = this.extractImageUrl($property, 'https://realestate.yahoo.co.jp');
          
          // タイトルを生成
          let title = '';
          const lines = fullText.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && trimmed.length > 5 && trimmed.length < 50 && 
                !trimmed.includes('万円') && !trimmed.includes('m²') && 
                !trimmed.includes('東京都') && !trimmed.includes('徒歩')) {
              title = trimmed;
              break;
            }
          }
          
          // フォールバック
          if (!title) {
            title = address ? `${address} ${layout}`.trim() : `Yahoo Property ${layout}`.trim();
          }
          
          // アクセス情報
          const access: string[] = [];
          const accessMatches = fullText.match(/[^\n]*駅[^\n]*徒歩\d+分/g);
          if (accessMatches) {
            access.push(...accessMatches.slice(0, 3));
          }
          
          console.log(`Yahoo Property: ${title}, Price: ${price}, Area: ${area}, Layout: ${layout}, Address: ${address}, Image URL: ${imageUrl || 'not found'}`);
          
          if (title && price && fullUrl && area) {
            const id = generatePropertyId(address, area, price);
            
            console.log(`🏠 Creating Yahoo property object:`, {
              title,
              image_url: imageUrl || 'undefined',
              has_image: !!imageUrl
            });
            
            properties.push({
              id,
              url: fullUrl,
              title,
              price,
              address,
              layout,
              area,
              building_type: 'apartment',
              access,
              image_url: imageUrl || undefined
            });
          }
        } catch (err) {
          console.error('Error parsing Yahoo property:', err);
        }
      });

      const propertiesWithImages = properties.filter(p => p.image_url);
      console.log(`Yahoo Real Estate Total properties extracted: ${properties.length}`);
      console.log(`Yahoo Real Estate Properties with images: ${propertiesWithImages.length}`);
      if (properties.length > 0) {
        console.log(`Yahoo Real Estate Image success rate: ${((propertiesWithImages.length / properties.length) * 100).toFixed(1)}%`);
      }
      
      return properties;
    } catch (error) {
      console.error(`Error scraping Yahoo Real Estate ${url}:`, error);
      return [];
    }
  }
}