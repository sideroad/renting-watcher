import axios from 'axios';
import * as cheerio from 'cheerio';
import { Property } from '../types';
import { generatePropertyId, normalizeAddress } from '../utils';
import { BaseScraper } from './base';

export class GoodroomsScraper extends BaseScraper {
  async scrapeUrl(url: string): Promise<Property[]> {
    try {
      const response = await axios.get(url, this.getRequestConfig());
      const $ = cheerio.load(response.data);
      const properties: Property[] = [];

      // 「他にもこんなお部屋がオススメです」以降を除外するため、ページ全体を分割
      let htmlContent = response.data;
      const recommendationIndex = htmlContent.indexOf('他にもこんなお部屋がオススメです');
      if (recommendationIndex !== -1) {
        htmlContent = htmlContent.substring(0, recommendationIndex);
        console.log('Found recommendation section, excluding content after it');
      }
      
      // 修正されたHTMLを再度パース
      const $filtered = cheerio.load(htmlContent);

      // Goodrooms物件要素を取得 - より幅広いセレクタを試行
      let propertyElements = $filtered('a[href*="/tokyo/detail/"]');
      console.log(`Found ${propertyElements.length} properties with detail links (after filtering recommendations)`);
      
      // フォールバック: 他のセレクタを試行
      if (propertyElements.length === 0) {
        propertyElements = $filtered('a[href*="/detail/"]');
        console.log(`Fallback 1: Found ${propertyElements.length} properties with /detail/ links`);
      }
      
      if (propertyElements.length === 0) {
        propertyElements = $filtered('a').filter((_, el) => {
          const href = $filtered(el).attr('href');
          return !!(href && href.includes('detail'));
        });
        console.log(`Fallback 2: Found ${propertyElements.length} properties with detail in href`);
      }
      
      // デバッグ: 全てのリンクを表示
      if (propertyElements.length === 0) {
        console.log('No property links found. Checking all links:');
        $filtered('a').each((i, el) => {
          const href = $filtered(el).attr('href');
          if (href && i < 10) { // 最初の10個のリンクのみ表示
            console.log(`Link ${i}: ${href}`);
          }
        });
      }

      propertyElements.each((_, element) => {
        try {
          const $property = $filtered(element);
          
          // 物件URLを取得
          const relativeUrl = $property.attr('href');
          const fullUrl = relativeUrl ? `https://www.goodrooms.jp${relativeUrl}` : '';
          
          if (!fullUrl) return;
          
          // 価格を取得 - より幅広いパターンに対応
          let price = '';
          const fullText = $property.text();
          
          // パターン1: "256,000円" のような形式
          let match = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
          if (match) {
            price = match[1] + '円';
          }
          
          // パターン2: "256000円" のような形式（カンマなし）
          if (!price) {
            match = fullText.match(/(\d{5,7})\s*円/);
            if (match) {
              price = match[1] + '円';
            }
          }
          
          console.log(`Price extraction debug: "${price}" from text: "${fullText.substring(0, 200)}..."`);  
          
          // 住所を取得 - より柔軟なパターン
          let address = '';
          const addressMatch = fullText.match(/東京都[^/\n]*?[区市]/);
          if (addressMatch) {
            address = addressMatch[0].trim();
            
            // 丁目レベルまでに正規化
            address = normalizeAddress(address);
          }
          
          // 間取り（3LDKなど）を取得
          let layout = '';
          const layoutMatch = fullText.match(/\d+[LDKS]+[DKS]*/);
          if (layoutMatch) {
            layout = layoutMatch[0];
          }
          
          // 面積を取得
          let area = '';
          const areaMatch = fullText.match(/(\d+\.?\d*)\s*㎡/);
          if (areaMatch) {
            area = areaMatch[0];
          }
          
          // 画像URLを取得
          let imageUrl = this.extractImageUrl($property, 'https://www.goodrooms.jp');
          
          // タイトルを生成 - 物件名を取得してみる
          let title = '';
          
          // 物件名を探す（最初の行や特徴的なテキスト）
          const lines = fullText.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && trimmed.length > 3 && trimmed.length < 50 && 
                !trimmed.includes('円') && !trimmed.includes('㎡') && 
                !trimmed.includes('東京都') && !trimmed.includes('管理費')) {
              title = trimmed;
              break;
            }
          }
          
          // フォールバック
          if (!title) {
            title = address ? `${address} ${layout}`.trim() : `Goodrooms Property ${layout}`.trim();
          }
          
          // アクセス情報（駅情報など）
          const access: string[] = [];
          $property.find('*').each((_, el) => {
            const text = $filtered(el).text().trim();
            if (text.includes('駅') && text.includes('分') && text.length < 50) {
              access.push(text);
            }
          });
          
          console.log(`Goodrooms Property: ${title}, Price: ${price}, Area: ${area}, Layout: ${layout}, Address: ${address}, Image URL: ${imageUrl || 'not found'}`);
          
          if (title && price && fullUrl && area) {
            const id = generatePropertyId(address, area, price);
            
            console.log(`🏠 Creating Goodrooms property object:`, {
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
          console.error('Error parsing Goodrooms property:', err);
        }
      });

      const propertiesWithImages = properties.filter(p => p.image_url);
      console.log(`Goodrooms Total properties extracted: ${properties.length}`);
      console.log(`Goodrooms Properties with images: ${propertiesWithImages.length}`);
      if (properties.length > 0) {
        console.log(`Goodrooms Image success rate: ${((propertiesWithImages.length / properties.length) * 100).toFixed(1)}%`);
      }
      
      return properties;
    } catch (error) {
      console.error(`Error scraping Goodrooms ${url}:`, error);
      return [];
    }
  }
}