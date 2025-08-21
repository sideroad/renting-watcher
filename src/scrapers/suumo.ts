import axios from 'axios';
import * as cheerio from 'cheerio';
import { Property } from '../types';
import { generatePropertyId, normalizeAddress } from '../utils';
import { BaseScraper } from './base';

export class SuumoScraper extends BaseScraper {
  async scrapeUrl(url: string): Promise<Property[]> {
    try {
      const response = await axios.get(url, this.getRequestConfig());
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
        
        // 古いロジック（建物ごと表示用）
        buildingContainers.each((_, buildingElement) => {
          const $building = $(buildingElement);
          
          const buildingTitle = $building.find('h3').first().text().trim() || 
                               $building.find('h2').first().text().trim() ||
                               $building.find('.bukken-name').text().trim() ||
                               $building.find('.cassetteitem_detail-title').first().text().trim() ||
                               $building.find('h1').first().text().trim();
          
          let buildingAddress = $building.find('.ui-text-detail').text().trim();
          
          // 丁目レベルまでに正規化
          if (buildingAddress) {
            buildingAddress = normalizeAddress(buildingAddress);
          }
          
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

          // 画像URLを取得
          let imageUrl = this.extractSuumoImage($building);
          
          console.log(`Building: ${buildingTitle}, Image URL: ${imageUrl || 'not found'}`);

          if ((!buildingTitle || buildingTitle === "") && area && price && fullUrl) {
            const estimatedTitle = `Property-${area}-${price}`;
            const id = generatePropertyId(buildingAddress, area, price);
            
            console.log(`🏢 Creating building property object:`, {
              title: estimatedTitle,
              image_url: imageUrl || 'undefined',
              has_image: !!imageUrl
            });
            
            properties.push({
              id,
              url: fullUrl,
              title: estimatedTitle,
              price,
              address: buildingAddress,
              layout,
              area,
              building_type: 'apartment',
              access,
              image_url: imageUrl || undefined
            });
          } else if (buildingTitle && area && price && fullUrl) {
            const title = `${buildingTitle} ${layout || ''}`.trim();
            const id = generatePropertyId(buildingAddress, area, price);
            
            console.log(`🏢 Creating building property object:`, {
              title,
              image_url: imageUrl || 'undefined',
              has_image: !!imageUrl
            });
            
            properties.push({
              id,
              url: fullUrl,
              title,
              price,
              address: buildingAddress,
              layout,
              area,
              building_type: 'apartment',
              access,
              image_url: imageUrl || undefined
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
          
          let address = $room.find('.detailbox-property-col').filter((_, el) => {
            const text = $(el).text();
            return (text.includes('区') || text.includes('市')) && !text.includes('万円');
          }).first().text().trim();
          
          // 丁目レベルまでに正規化
          if (address) {
            address = normalizeAddress(address);
          }
          
          const layoutAreaCell = $room.find('.detailbox-property-col.detailbox-property--col3').text().trim();
          const layout = layoutAreaCell.match(/\d+[DLKR]+[KDL]*/)?.[0] || '';
          const area = layoutAreaCell.match(/\d+\.?\d*m[²2㎡]/)?.[0] || '';
          
          const access: string[] = [];
          if (propertyName) {
            access.push(propertyName);
          }
          
          // 画像URLを取得
          let imageUrl = this.extractSuumoImage($room);
          
          console.log(`Property: ${propertyName}, Image URL: ${imageUrl || 'not found'}`);
          
          if (propertyName && area && price && fullUrl) {
            const title = `${propertyName} ${layout || ''}`.trim();
            const id = generatePropertyId(address, area, price);
            
            console.log(`🏠 Creating property object:`, {
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
        });
      }

      const propertiesWithImages = properties.filter(p => p.image_url);
      console.log(`SUUMO Total properties extracted: ${properties.length}`);
      console.log(`SUUMO Properties with images: ${propertiesWithImages.length}`);
      if (properties.length > 0) {
        console.log(`SUUMO Image success rate: ${((propertiesWithImages.length / properties.length) * 100).toFixed(1)}%`);
      }

      return properties;
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return [];
    }
  }

  protected async scrapePageWithNext(url: string): Promise<{ properties: Property[], nextUrl?: string }> {
    try {
      const response = await axios.get(url, this.getRequestConfig());
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
        
        // 古いロジック（建物ごと表示用）
        buildingContainers.each((_, buildingElement) => {
          const $building = $(buildingElement);
          
          const buildingTitle = $building.find('h3').first().text().trim() || 
                               $building.find('h2').first().text().trim() ||
                               $building.find('.bukken-name').text().trim() ||
                               $building.find('.cassetteitem_detail-title').first().text().trim() ||
                               $building.find('h1').first().text().trim();
          
          let buildingAddress = $building.find('.ui-text-detail').text().trim();
          
          // 丁目レベルまでに正規化
          if (buildingAddress) {
            buildingAddress = normalizeAddress(buildingAddress);
          }
          
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

          // 画像URLを取得
          let imageUrl = this.extractSuumoImage($building);
          
          console.log(`Building: ${buildingTitle}, Image URL: ${imageUrl || 'not found'}`);

          if ((!buildingTitle || buildingTitle === "") && area && price && fullUrl) {
            const estimatedTitle = `Property-${area}-${price}`;
            const id = generatePropertyId(buildingAddress, area, price);
            
            console.log(`🏢 Creating building property object:`, {
              title: estimatedTitle,
              image_url: imageUrl || 'undefined',
              has_image: !!imageUrl
            });
            
            properties.push({
              id,
              url: fullUrl,
              title: estimatedTitle,
              price,
              address: buildingAddress,
              layout,
              area,
              building_type: 'apartment',
              access,
              image_url: imageUrl || undefined
            });
          } else if (buildingTitle && area && price && fullUrl) {
            const title = `${buildingTitle} ${layout || ''}`.trim();
            const id = generatePropertyId(buildingAddress, area, price);
            
            console.log(`🏢 Creating building property object:`, {
              title,
              image_url: imageUrl || 'undefined',
              has_image: !!imageUrl
            });
            
            properties.push({
              id,
              url: fullUrl,
              title,
              price,
              address: buildingAddress,
              layout,
              area,
              building_type: 'apartment',
              access,
              image_url: imageUrl || undefined
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
          
          let address = $room.find('.detailbox-property-col').filter((_, el) => {
            const text = $(el).text();
            return (text.includes('区') || text.includes('市')) && !text.includes('万円');
          }).first().text().trim();
          
          // 丁目レベルまでに正規化
          if (address) {
            address = normalizeAddress(address);
          }
          
          const layoutAreaCell = $room.find('.detailbox-property-col.detailbox-property--col3').text().trim();
          const layout = layoutAreaCell.match(/\d+[DLKR]+[KDL]*/)?.[0] || '';
          const area = layoutAreaCell.match(/\d+\.?\d*m[²㎡2]/)?.[0] || '';
          
          const access: string[] = [];
          if (propertyName) {
            access.push(propertyName);
          }
          
          // 画像URLを取得
          let imageUrl = this.extractSuumoImage($room);
          
          console.log(`Property: ${propertyName}, Image URL: ${imageUrl || 'not found'}`);
          
          if (propertyName && area && price && fullUrl) {
            const title = `${propertyName} ${layout || ''}`.trim();
            const id = generatePropertyId(address, area, price);
            
            console.log(`🏠 Creating property object:`, {
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
        });
      }

      // ページネーションの「次へ」リンクを探す
      let nextUrl: string | undefined;
      const nextLink = $('.pagination-parts a').filter((_, el) => {
        const text = $(el).text().trim();
        return text === '次へ';
      }).attr('href');
      
      if (nextLink) {
        nextUrl = `https://suumo.jp${nextLink}`;
        console.log(`Found next page: ${nextUrl}`);
      } else {
        console.log('No next page found');
      }

      const propertiesWithImages = properties.filter(p => p.image_url);
      console.log(`SUUMO Page properties extracted: ${properties.length}`);
      console.log(`SUUMO Properties with images: ${propertiesWithImages.length}`);
      if (properties.length > 0) {
        console.log(`SUUMO Image success rate: ${((propertiesWithImages.length / properties.length) * 100).toFixed(1)}%`);
      }

      return { properties, nextUrl };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return { properties: [] };
    }
  }

  private extractSuumoImage($element: any): string | undefined {
    let imageUrl: string | undefined;
    
    // 方法1: imgタグを探す
    const imgElements = $element.find('img');
    imgElements.each((_: any, img: any) => {
      const $img = cheerio.load(img)('body').children().first();
      const src = $img.attr('src');
      const dataSrc = $img.attr('data-src');
      const dataOriginal = $img.attr('data-original');
      
      // Prioritize actual image URLs
      if (dataSrc && !dataSrc.includes('transparent.gif')) {
        imageUrl = dataSrc;
      } else if (dataOriginal) {
        imageUrl = dataOriginal;
      } else if (src && !src.includes('transparent.gif')) {
        imageUrl = src;
      }
      
      // Convert relative URLs to absolute
      if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = `https://suumo.jp${imageUrl}`;
      }
      
      // Stop if we found a valid image
      if (imageUrl) {
        return false; // Break the each loop
      }
    });
    
    // 既にhttps://で始まっている場合はそのまま使用
    if (imageUrl && !imageUrl.startsWith('http')) {
      const src = imageUrl;
      // 相対URLの処理
      if (src.startsWith('//')) {
        imageUrl = 'https:' + src;
      } else if (src.startsWith('/')) {
        imageUrl = `https://suumo.jp${src}`;
      }
    }
    
    // 方法2: background-imageスタイルをチェック
    if (!imageUrl) {
      imageUrl = this.extractBackgroundImage($element);
    }
    
    return imageUrl;
  }
}