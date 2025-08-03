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

          // 画像URLを取得（複数の方法で試行）
          let imageUrl = '';
          
          // 方法1: 通常のimg要素
          const imageElement = $building.find('img').first();
          if (imageElement.length > 0) {
            // rel属性から画像URLを取得（SUUMOの遅延読み込み画像）
            const rel = imageElement.attr('rel');
            const src = imageElement.attr('src');
            const dataSrc = imageElement.attr('data-src');
            const dataOriginal = imageElement.attr('data-original');
            
            if (rel && rel.startsWith('http')) {
              imageUrl = rel;
            } else if (src && src.startsWith('http') && !src.includes('data:image')) {
              imageUrl = src;
            } else if (dataSrc && dataSrc.startsWith('http') && !dataSrc.includes('data:image')) {
              imageUrl = dataSrc;
            } else if (dataOriginal && dataOriginal.startsWith('http') && !dataOriginal.includes('data:image')) {
              imageUrl = dataOriginal;
            } else if (rel && rel.startsWith('/')) {
              imageUrl = `https://suumo.jp${rel}`;
            } else if (src && src.startsWith('/') && !src.includes('data:image')) {
              imageUrl = `https://suumo.jp${src}`;
            }
          }
          
          // 方法2: background-imageスタイルをチェック
          if (!imageUrl) {
            $building.find('*').each((_, el) => {
              const style = $(el).attr('style');
              if (style && style.includes('background-image')) {
                const match = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
                if (match && match[1] && !match[1].includes('data:image')) {
                  imageUrl = match[1].startsWith('http') ? match[1] : `https://suumo.jp${match[1]}`;
                  return false; // break
                }
              }
            });
          }
          
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
          
          // 画像URLを取得（複数の方法で試行）
          let imageUrl = '';
          
          // 方法1: 通常のimg要素
          const allImages = $room.find('img');
          console.log(`Found ${allImages.length} images for property: ${propertyName}`);
          
          allImages.each((idx, img) => {
            const src = $(img).attr('src');
            const dataSrc = $(img).attr('data-src');
            const dataOriginal = $(img).attr('data-original');
            const rel = $(img).attr('rel');
            const alt = $(img).attr('alt');
            console.log(`  Image ${idx}: src="${src}", data-src="${dataSrc}", data-original="${dataOriginal}", rel="${rel}", alt="${alt}"`);
          });
          
          const imageElement = $room.find('img').first();
          if (imageElement.length > 0) {
            // rel属性から画像URLを取得（SUUMOの遅延読み込み画像）
            const rel = imageElement.attr('rel');
            const src = imageElement.attr('src');
            const dataSrc = imageElement.attr('data-src');
            const dataOriginal = imageElement.attr('data-original');
            
            if (rel && rel.startsWith('http')) {
              imageUrl = rel;
            } else if (src && src.startsWith('http') && !src.includes('data:image')) {
              imageUrl = src;
            } else if (dataSrc && dataSrc.startsWith('http') && !dataSrc.includes('data:image')) {
              imageUrl = dataSrc;
            } else if (dataOriginal && dataOriginal.startsWith('http') && !dataOriginal.includes('data:image')) {
              imageUrl = dataOriginal;
            } else if (rel && rel.startsWith('/')) {
              imageUrl = `https://suumo.jp${rel}`;
            } else if (src && src.startsWith('/') && !src.includes('data:image')) {
              imageUrl = `https://suumo.jp${src}`;
            }
          }
          
          // 方法2: background-imageスタイルをチェック
          if (!imageUrl) {
            $room.find('*').each((_, el) => {
              const style = $(el).attr('style');
              if (style && style.includes('background-image')) {
                const match = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
                if (match && match[1] && !match[1].includes('data:image')) {
                  imageUrl = match[1].startsWith('http') ? match[1] : `https://suumo.jp${match[1]}`;
                  return false; // break
                }
              }
            });
          }
          
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
            // h3, h2, またはリンクテキストを探す
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
          
          // 画像URLを取得（複数の方法で試行）
          let imageUrl = '';
          
          // lazyloadクラスの画像を優先的に使用
          const allImages = $property.find('img');
          allImages.each((idx, img) => {
            const $img = $(img);
            const className = $img.attr('class');
            const dataSrc = $img.attr('data-src');
            
            // lazyload クラスの画像を優先的に使用
            if (!imageUrl && className && className.includes('lazyload') && dataSrc && dataSrc !== 'undefined' && dataSrc.startsWith('http')) {
              imageUrl = dataSrc;
            }
          });
          
          // フォールバック: 従来の方法
          if (!imageUrl) {
            const imageElement = $property.find('img').first();
            if (imageElement.length > 0) {
              const dataSrc = imageElement.attr('data-src');
              const src = imageElement.attr('src');
              const dataOriginal = imageElement.attr('data-original');
              
              if (dataSrc && dataSrc !== 'undefined' && dataSrc.startsWith('http') && !dataSrc.includes('data:image')) {
                imageUrl = dataSrc;
              } else if (dataOriginal && dataOriginal !== 'undefined' && dataOriginal.startsWith('http') && !dataOriginal.includes('data:image')) {
                imageUrl = dataOriginal;
              } else if (src && src.startsWith('http') && !src.includes('data:image') && !src.includes('icon_mansion_apart.svg') && !src.includes('lazy-load-pc.gif')) {
                imageUrl = src;
              }
            }
          }
          
          // 方法2: background-imageスタイルをチェック
          if (!imageUrl) {
            $property.find('*').each((_, el) => {
              const style = $(el).attr('style');
              if (style && style.includes('background-image')) {
                const match = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
                if (match && match[1] && !match[1].includes('data:image') && !match[1].includes('icon_mansion_apart.svg') && !match[1].includes('lazy-load-pc.gif')) {
                  imageUrl = match[1].startsWith('http') ? match[1] : `https://myhome.nifty.com${match[1]}`;
                  return false; // break
                }
              }
            });
          }
          
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

export class GoodroomsScraper {
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
          let imageUrl = '';
          const imageElement = $property.find('img').first();
          if (imageElement.length > 0) {
            const src = imageElement.attr('src');
            const dataSrc = imageElement.attr('data-src');
            
            if (src && src.startsWith('http') && !src.includes('data:image')) {
              imageUrl = src;
            } else if (dataSrc && dataSrc.startsWith('http') && !dataSrc.includes('data:image')) {
              imageUrl = dataSrc;
            }
          }
          
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
            const text = $(el).text().trim();
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

  async scrapeAll(urls: string[]): Promise<Property[]> {
    const allProperties: Property[] = [];
    
    for (const url of urls) {
      console.log(`Scraping Goodrooms URL: ${url}`);
      const properties = await this.scrapeUrl(url);
      allProperties.push(...properties);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return this.deduplicateProperties(allProperties);
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