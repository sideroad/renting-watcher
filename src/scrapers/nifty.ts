import axios from 'axios';
import * as cheerio from 'cheerio';
import { Property } from '../types';
import { generatePropertyId, normalizeAddress } from '../utils';
import { BaseScraper } from './base';

export class NiftyScraper extends BaseScraper {
  async scrapeUrl(url: string): Promise<Property[]> {
    try {
      const response = await axios.get(url, this.getRequestConfig());
      const $ = cheerio.load(response.data);
      const properties: Property[] = [];

      // Nifty賃貸の物件要素を取得
      const propertyElements = $('.result-bukken-list');
      console.log(`Found ${propertyElements.length} properties with .result-bukken-list selector`);

      propertyElements.each((_, element) => {
        try {
          const $property = $(element);
          
          // 物件タイトル（複数の方法で試行）
          let title = $property.find('.bukken-list-name a').text().trim();
          
          // フォールバック: 画像のalt属性から取得
          if (!title) {
            const altText = $property.find('img.lazyload.thumbnail').attr('alt');
            if (altText && altText !== '間取り図' && !altText.includes('建物画像')) {
              title = altText.trim();
            }
          }
          
          // さらなるフォールバック: 他の要素からタイトルを探す
          if (!title) {
            title = $property.find('h3 a, h2 a, a[href*="/detail_"]').first().text().trim();
          }
          
          // 価格（家賃）（複数の方法で試行）
          let price = $property.find('.rent').text().trim().replace(/[^\d.万円]/g, '');
          
          // フォールバック: 万円を含むテキストを探す
          if (!price) {
            $property.find('*').each((_, el) => {
              const text = $(el).text().trim();
              if (text.includes('万円') && text.length < 15 && /\d+\.?\d*万円/.test(text)) {
                price = text.replace(/[^\d.万円]/g, '');
                return false; // break
              }
            });
          }
          
          // 物件URL（複数の方法で試行）
          let relativeUrl = $property.find('.bukken-list-name a').attr('href');
          
          // フォールバック: detail_を含むリンクを探す
          if (!relativeUrl) {
            relativeUrl = $property.find('a[href*="/detail_"]').attr('href');
          }
          
          const fullUrl = relativeUrl ? `https://myhome.nifty.com${relativeUrl}` : '';
          
          // 住所を取得（地図マーカーアイコンの後のテキスト）
          let address = '';
          $property.find('tr').each((_, row) => {
            const $row = $(row);
            if ($row.find('svg.mapmarker-icon').length > 0) {
              // アイコンの後のテキストノードを取得
              const td = $row.find('td.bukken-attr-td').get(0);
              if (td) {
                const textNodes = $(td).contents().filter(function() {
                  return this.nodeType === 3; // テキストノードのみ
                });
                address = textNodes.text().trim().replace(/[\ue003\ue004\ue005\ue002]/g, '');
                
                // 丁目レベルまでに正規化
                if (address) {
                  address = normalizeAddress(address);
                }
              }
            }
          });
          
          // 間取り
          const layout = $property.find('tr').filter((_, el) => {
            return $(el).text().includes('間取り');
          }).find('td').last().text().trim();
          
          // 面積（複数の方法で試行）
          let area = $property.find('tr').filter((_, el) => {
            return $(el).text().includes('専有面積');
          }).find('td').last().text().trim();
          
          // フォールバック: m²や㎡を含むテキストを探す
          if (!area) {
            $property.find('*').each((_, el) => {
              const text = $(el).text().trim();
              if ((text.includes('m²') || text.includes('㎡') || text.includes('m2')) && 
                  text.length < 20 && /\d+\.?\d*(m²|㎡|m2)/.test(text)) {
                area = text.match(/\d+\.?\d*(m²|㎡|m2)/)?.[0] || '';
                if (area) return false; // break
              }
            });
          }
          
          // 階数
          const floor = $property.find('tr').filter((_, el) => {
            return $(el).text().includes('階 / 建物階');
          }).find('td').last().text().trim();
          
          // アクセス情報（駅からの距離）
          const access: string[] = [];
          $property.find('.bukken-list-station').each((_, el) => {
            const stationInfo = $(el).text().trim();
            if (stationInfo) {
              access.push(stationInfo);
            }
          });
          
          // 画像URLを取得
          let imageUrl = this.extractNiftyImage($property);
          
          console.log(`Nifty Property: ${title}, Image URL: ${imageUrl || 'not found'}`);
          
          if (title && price && fullUrl && area) {
            const id = generatePropertyId(address, area, price);
            const propertyTitle = `${title} ${floor} ${layout}`.trim();
            
            console.log(`🏠 Creating Nifty property object:`, {
              title: propertyTitle,
              image_url: imageUrl || 'undefined',
              has_image: !!imageUrl
            });
            
            properties.push({
              id,
              url: fullUrl,
              title: propertyTitle,
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
          console.error('Error parsing property:', err);
        }
      });

      const propertiesWithImages = properties.filter(p => p.image_url);
      console.log(`Total properties extracted: ${properties.length}`);
      console.log(`Properties with images: ${propertiesWithImages.length}`);
      console.log(`Image success rate: ${((propertiesWithImages.length / properties.length) * 100).toFixed(1)}%`);
      
      return properties;
    } catch (error) {
      console.error(`Error scraping Nifty ${url}:`, error);
      return [];
    }
  }

  // Use base class implementation for scrapeAll

  private extractNiftyImage($property: cheerio.Cheerio<cheerio.Element>): string {
    let imageUrl = '';
    
    // lazyloadクラスの画像を優先的に使用
    const allImages = $property.find('img');
    allImages.each((idx, img) => {
      const $img = $property.constructor(img) as cheerio.Cheerio<cheerio.Element>;
      const className = $img.attr('class');
      const dataSrc = $img.attr('data-src');
      
      // lazyload クラスの画像を優先的に使用
      if (!imageUrl && className && className.includes('lazyload') && dataSrc && dataSrc !== 'undefined' && dataSrc.startsWith('http')) {
        imageUrl = dataSrc;
      }
    });
    
    // フォールバック: 従来の方法
    if (!imageUrl) {
      imageUrl = this.extractImageUrl($property, 'https://myhome.nifty.com');
    }
    
    // 方法2: background-imageスタイルをチェック
    if (!imageUrl) {
      imageUrl = this.extractBackgroundImage($property, 'https://myhome.nifty.com');
    }
    
    // Filter out unwanted images
    if (imageUrl && (imageUrl.includes('icon_mansion_apart.svg') || imageUrl.includes('lazy-load-pc.gif'))) {
      imageUrl = '';
    }
    
    return imageUrl;
  }
}