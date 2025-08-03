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
            const id = generatePropertyId(buildingAddress, area, price);
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
            const id = generatePropertyId(buildingAddress, area, price);
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
            const id = generatePropertyId(address, area, price);
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

export class NiftyScraper {
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

      // Nifty賃貸の物件要素を取得
      const propertyElements = $('.result-bukken-list');
      console.log(`Found ${propertyElements.length} properties with .result-bukken-list selector`);

      propertyElements.each((_, element) => {
        try {
          const $property = $(element);
          
          // 物件タイトル
          const title = $property.find('.bukken-list-name a').text().trim();
          
          // 価格（家賃）
          const price = $property.find('.rent').text().trim().replace(/[^\d.万円]/g, '');
          
          // 物件URL
          const relativeUrl = $property.find('.bukken-list-name a').attr('href');
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
              }
            }
          });
          
          // 間取り
          const layout = $property.find('tr').filter((_, el) => {
            return $(el).text().includes('間取り');
          }).find('td').last().text().trim();
          
          // 面積
          const area = $property.find('tr').filter((_, el) => {
            return $(el).text().includes('専有面積');
          }).find('td').last().text().trim();
          
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
          
          if (title && price && fullUrl && area) {
            const id = generatePropertyId(address, area, price);
            const propertyTitle = `${title} ${floor} ${layout}`.trim();
            
            properties.push({
              id,
              url: fullUrl,
              title: propertyTitle,
              price,
              address,
              layout,
              area,
              building_type: 'apartment',
              access
            });
          }
        } catch (err) {
          console.error('Error parsing property:', err);
        }
      });

      console.log(`Total properties extracted: ${properties.length}`);
      return properties;
    } catch (error) {
      console.error(`Error scraping Nifty ${url}:`, error);
      return [];
    }
  }

  async scrapeAll(urls: string[]): Promise<Property[]> {
    const allProperties: Property[] = [];
    for (const url of urls) {
      console.log(`Scraping Nifty URL: ${url}`);
      
      // First page
      let currentUrl = url;
      let pageNum = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        console.log(`Scraping page ${pageNum}...`);
        const properties = await this.scrapeUrl(currentUrl);
        console.log(`Found ${properties.length} properties on page ${pageNum}`);
        allProperties.push(...properties);
        
        // Check if there are more pages by trying to fetch HTML and look for pagination
        try {
          const response = await axios.get(currentUrl, {
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
          
          // Look for next page link
          let nextPageUrl = '';
          
          // Try various pagination selectors
          const paginationSelectors = [
            'a[href*="page="]',
            'a.next',
            'a:contains("次へ")',
            'a:contains(">")',
            '.pagination a',
            '.pager a',
            'a[rel="next"]'
          ];
          
          for (const selector of paginationSelectors) {
            const nextLink = $(selector).filter((_, el) => {
              const href = $(el).attr('href');
              const text = $(el).text();
              // Check if this is a next page link
              return !!(href && (
                href.includes(`page=${pageNum + 1}`) ||
                href.includes(`p=${pageNum + 1}`) ||
                text === '>' ||
                text === '次へ' ||
                text === `${pageNum + 1}`
              ));
            }).first();
            
            if (nextLink.length > 0) {
              const href = nextLink.attr('href');
              if (href) {
                nextPageUrl = href.startsWith('http') ? href : `https://myhome.nifty.com${href}`;
                break;
              }
            }
          }
          
          // Alternative: build next page URL manually
          if (!nextPageUrl && pageNum === 1) {
            // Check if URL already has page parameter
            if (currentUrl.includes('page=') || currentUrl.includes('p=')) {
              // Replace existing page parameter
              nextPageUrl = currentUrl.replace(/([?&])(page|p)=\d+/, `$1$2=${pageNum + 1}`);
            } else {
              // Add page parameter
              const separator = currentUrl.includes('?') ? '&' : '?';
              nextPageUrl = `${currentUrl}${separator}page=${pageNum + 1}`;
            }
            
            // Verify if next page exists by checking if we get properties
            const testProperties = await this.scrapeUrl(nextPageUrl);
            if (testProperties.length === 0) {
              hasMorePages = false;
            } else {
              currentUrl = nextPageUrl;
              pageNum++;
            }
          } else if (nextPageUrl) {
            currentUrl = nextPageUrl;
            pageNum++;
          } else {
            hasMorePages = false;
          }
          
          // Safety check: don't scrape more than 10 pages
          if (pageNum > 10) {
            console.log('Reached maximum page limit');
            hasMorePages = false;
          }
        } catch (error) {
          console.error('Error checking for next page:', error);
          hasMorePages = false;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log(`Total properties found for this URL: ${allProperties.length}`);
    }
    return this.deduplicateProperties(allProperties);
  }

  private deduplicateProperties(properties: Property[]): Property[] {
    const uniqueProperties = new Map<string, Property>();
    for (const property of properties) {
      if (!uniqueProperties.has(property.id)) {
        uniqueProperties.set(property.id, property);
      }
    }
    return Array.from(uniqueProperties.values());
  }
}