import axios from 'axios';
import * as cheerio from 'cheerio';
import { Property } from '../types';
import { generatePropertyId, normalizeAddress } from '../utils';
import { BaseScraper } from './base';

export class RStoreScraper extends BaseScraper {
  async scrapeUrl(url: string): Promise<Property[]> {
    try {
      const response = await axios.get(url, this.getRequestConfig());
      const $ = cheerio.load(response.data);
      const properties: Property[] = [];

      // R-Store物件要素を取得 - 複数のセレクタを試行
      let propertyElements = $('.property-item, .item, .search-result-item, .property-card');
      console.log(`Found ${propertyElements.length} R-Store properties with common property classes`);
      
      // フォールバック: リンクベースでの検索
      if (propertyElements.length === 0) {
        propertyElements = $('a[href*="/detail/"], a[href*="/property/"], a[href*="/room/"]');
        console.log(`Fallback: Found ${propertyElements.length} R-Store properties with detail links`);
      }
      
      // フォールバック: 一般的な構造での検索
      if (propertyElements.length === 0) {
        propertyElements = $('.result-item, .listing-item, .bukken-item');
        console.log(`Fallback 2: Found ${propertyElements.length} R-Store properties with result classes`);
      }
      
      // デバッグ: ページの主要な構造を確認
      if (propertyElements.length === 0) {
        console.log('No R-Store property elements found. Checking page structure:');
        console.log(`Page title: ${$('title').text()}`);
        console.log(`Main content elements: ${$('main, .main, #main, .content, .container').length}`);
        console.log(`List elements: ${$('ul, ol, .list').length}`);
        console.log(`Total links: ${$('a').length}`);
        
        // すべてのリンクの最初の10個を確認
        $('a').slice(0, 10).each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim();
          if (href && text) {
            console.log(`Link ${i}: ${href} - "${text.substring(0, 50)}"`);
          }
        });
      }

      propertyElements.each((_, element) => {
        try {
          const $property = $(element);
          
          // 物件URLを取得
          let detailUrl = $property.attr('href');
          if (!detailUrl) {
            detailUrl = $property.find('a').first().attr('href');
          }
          
          const fullUrl = detailUrl ? 
            (detailUrl.startsWith('http') ? detailUrl : `https://www.r-store.jp${detailUrl}`) : '';
          
          if (!fullUrl) return;
          
          // 物件の全テキストを取得
          const fullText = $property.text();
          
          // 価格を取得
          let price = '';
          const priceMatch = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
          if (priceMatch) {
            price = priceMatch[1] + '円';
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
          
          // 面積を取得
          let area = '';
          const areaMatch = fullText.match(/(\d+\.?\d*)\s*[㎡m²]/);
          if (areaMatch) {
            area = areaMatch[0];
          }
          
          // 画像URLを取得
          let imageUrl = this.extractImageUrl($property, 'https://www.r-store.jp');
          
          // タイトルを生成
          let title = '';
          const lines = fullText.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && trimmed.length > 5 && trimmed.length < 50 && 
                !trimmed.includes('円') && !trimmed.includes('㎡') && 
                !trimmed.includes('東京都') && !trimmed.includes('徒歩')) {
              title = trimmed;
              break;
            }
          }
          
          // フォールバック
          if (!title) {
            title = address ? `${address} ${layout}`.trim() : `R-Store Property ${layout}`.trim();
          }
          
          // アクセス情報
          const access: string[] = [];
          const accessMatches = fullText.match(/[^\n]*駅[^\n]*徒歩\d+分/g);
          if (accessMatches) {
            access.push(...accessMatches.slice(0, 3)); // 最大3つまで
          }
          
          console.log(`R-Store Property: ${title}, Price: ${price}, Area: ${area}, Layout: ${layout}, Address: ${address}, Image URL: ${imageUrl || 'not found'}`);
          
          if (title && price && fullUrl && area) {
            const id = generatePropertyId(address, area, price);
            
            console.log(`🏠 Creating R-Store property object:`, {
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
          console.error('Error parsing R-Store property:', err);
        }
      });

      const propertiesWithImages = properties.filter(p => p.image_url);
      console.log(`R-Store Total properties extracted: ${properties.length}`);
      console.log(`R-Store Properties with images: ${propertiesWithImages.length}`);
      if (properties.length > 0) {
        console.log(`R-Store Image success rate: ${((propertiesWithImages.length / properties.length) * 100).toFixed(1)}%`);
      }
      
      return properties;
    } catch (error) {
      console.error(`Error scraping R-Store ${url}:`, error);
      return [];
    }
  }
}