import axios from 'axios';
import * as cheerio from 'cheerio';
import { Property } from './types';
import { generatePropertyId } from './utils';

export class SuumoScraper {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  async scrapeUrl(url: string): Promise<Property[]> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      const $ = cheerio.load(response.data);
      const properties: Property[] = [];

      // 部屋ごと表示の場合の新しいセレクタ（修正版）
      const roomContainers = $('.main .property.property--highlight.js-property.js-cassetLink');
      console.log(`Found ${roomContainers.length} room containers (room-by-room display)`);
      
      // 古い形式へのフォールバック
      if (roomContainers.length === 0) {
        let buildingContainers = $('.js-bukkenList').find('> div').first().children();
        if (buildingContainers.length === 0) {
          buildingContainers = $('.cassetteitem');
        }
        console.log(`Fallback to old format: ${buildingContainers.length} building containers`);
        
        // 古いロジック（建物ごと表示用）をここに残す
        buildingContainers.each((_, buildingElement) => {
          const $building = $(buildingElement);
          
          const buildingTitle = $building.find('h3').first().text().trim() || 
                               $building.find('h2').first().text().trim() ||
                               $building.find('.bukken-name').text().trim() ||
                               $building.find('.cassetteitem_detail-title').first().text().trim() ||
                               $building.find('h1').first().text().trim();
          
          const buildingAddress = $building.find('.ui-text-detail').text().trim();
          
          const access: string[] = [];
          $building.find('.ui-text-detail').each((_, el) => {
            const text = $(el).text().trim();
            if (text && text.includes('駅')) access.push(text);
          });
          
          const price = $building.find('*').filter((_, el) => {
            const text = $(el).text();
            return text.includes('万円') && text.length < 20;
          }).first().text().trim();
          
          const area = $building.find('*').filter((_, el) => {
            const text = $(el).text();
            return (text.includes('m²') || text.includes('㎡') || text.includes('m2')) && text.length < 20;
          }).first().text().trim();
          
          const layout = $building.find('*').filter((_, el) => {
            const text = $(el).text();
            return /\d+[DLKR]/.test(text) && text.length < 10;
          }).first().text().trim();
          
          const detailUrl = $building.find('a[href*="/chintai/"]').first().attr('href') || '';
          const fullUrl = detailUrl ? `https://suumo.jp${detailUrl}` : '';

          if ((!buildingTitle || buildingTitle === "") && area && price && fullUrl) {
            const estimatedTitle = `Property-${area}-${price}`;
            const id = generatePropertyId(estimatedTitle, area, price);
            properties.push({
              id,
              url: fullUrl,
              title: estimatedTitle,
              price,
              address: buildingAddress,
              layout,
              area,
              building_type: 'apartment',
              access
            });
          } else if (buildingTitle && area && price && fullUrl) {
            const title = `${buildingTitle} ${layout || ''}`.trim();
            const id = generatePropertyId(title, area, price);
            properties.push({
              id,
              url: fullUrl,
              title,
              price,
              address: buildingAddress,
              layout,
              area,
              building_type: 'apartment',
              access
            });
          }
        });
      } else {
        // 新しいロジック（部屋ごと表示用）
        roomContainers.each((_, roomElement) => {
          const $room = $(roomElement);
          
          const price = $room.find('.detailbox-property-point').text().trim();
          const propertyName = $room.find('.property_inner-title a').text().trim();
          const detailUrl = $room.find('a[href*="/chintai/bc_"]').attr('href') || '';
          const fullUrl = detailUrl ? `https://suumo.jp${detailUrl}` : '';
          
          const address = $room.find('.detailbox-property-col').filter((_, el) => {
            const text = $(el).text();
            return (text.includes('区') || text.includes('市')) && !text.includes('万円');
          }).first().text().trim();
          
          const layoutAreaCell = $room.find('.detailbox-property-col.detailbox-property--col3').text().trim();
          const layout = layoutAreaCell.match(/\d+[DLKR]+[KDL]*/)?.[0] || '';
          const area = layoutAreaCell.match(/\d+\.?\d*m[²2㎡]/)?.[0] || '';
          
          const access: string[] = [];
          if (propertyName) {
            access.push(propertyName);
          }
          
          
          if (propertyName && area && price && fullUrl) {
            const title = `${propertyName} ${layout || ''}`.trim();
            const id = generatePropertyId(title, area, price);
            properties.push({
              id,
              url: fullUrl,
              title,
              price,
              address,
              layout,
              area,
              building_type: 'apartment',
              access
            });
          }
        });
      }

      return properties;
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return [];
    }
  }

  async scrapeAll(urls: string[]): Promise<Property[]> {
    const allProperties: Property[] = [];
    
    for (const url of urls) {
      console.log(`Scraping: ${url}`);
      const properties = await this.scrapeUrl(url);
      allProperties.push(...properties);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const uniqueProperties = this.deduplicateProperties(allProperties);
    return uniqueProperties;
  }

  private deduplicateProperties(properties: Property[]): Property[] {
    const seen = new Set<string>();
    return properties.filter(property => {
      if (seen.has(property.id)) {
        return false;
      }
      seen.add(property.id);
      return true;
    });
  }
}