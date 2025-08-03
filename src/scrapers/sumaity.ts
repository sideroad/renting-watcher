import axios from 'axios';
import * as cheerio from 'cheerio';
import { Property } from '../types';
import { generatePropertyId, normalizeAddress, cleanupAddress } from '../utils';
import { BaseScraper } from './base';

export class SumaityScraper extends BaseScraper {
  async scrapeUrl(url: string): Promise<Property[]> {
    try {
      const response = await axios.get(url, this.getRequestConfig());
      const $ = cheerio.load(response.data);
      const properties: Property[] = [];

      console.log('Scraping Sumaity properties with targeted approach');
      
      // より具体的なアプローチ：実際の物件名のリンクを特定
      const propertyLinks = $('a').filter((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        
        // 実際の物件リンクの条件：
        // 1. hrefが物件詳細ページを指している
        // 2. テキストが建物名のような構造を持っている
        // 3. UIコンポーネントではない
        return !!(href && 
               (href.includes('bldg_') || href.includes('/chintai/') && href.includes('_bldg/')) &&
               text.length > 3 && text.length < 100 &&
               !text.includes('検索') && !text.includes('条件') &&
               !text.includes('登録') && !text.includes('メール') &&
               !text.includes('お気に入り') && !text.includes('お問い合わせ') &&
               !text.includes('チェック') && !text.includes('変更') &&
               !text.includes('絞り込み') && !text.includes('から探す') &&
               (text.includes('マンション') || text.includes('アパート') || 
                text.match(/[ァ-ヴー]{3,}/) || text.match(/[一-龯]{3,}/)));
      });
      
      console.log(`Found ${propertyLinks.length} Sumaity property links`);

      const processedTitles = new Set<string>();

      propertyLinks.each((_, element) => {
        try {
          const $link = $(element);
          const title = $link.text().trim();
          
          // 重複タイトルをスキップ
          if (processedTitles.has(title)) return;
          processedTitles.add(title);
          
          // 物件URLを取得
          const detailUrl = $link.attr('href');
          const fullUrl = detailUrl ? 
            (detailUrl.startsWith('http') ? detailUrl : `https://sumaity.com${detailUrl}`) : '';
          
          if (!fullUrl) return;
          
          // 物件名をクリーニング
          let cleanTitle = title;
          if (cleanTitle.startsWith('マンション')) {
            cleanTitle = cleanTitle.substring(4);
          }
          if (cleanTitle.includes('新着あり')) {
            cleanTitle = cleanTitle.replace('新着あり', '').trim();
          }
          
          // より大きなコンテキストを取得して詳細データを探す
          // 可能な限り大きな親要素から始めて、段階的に詳細データを探す
          let $container = $link.closest('tr, td, .property, .bukken');
          if ($container.length === 0) {
            // フォールバック: より多くの親要素を試す
            $container = $link.parent().parent().parent().parent();
          }
          
          const containerText = $container.text();
          const containerHtml = $container.html() || '';
          
          console.log(`Processing property: ${cleanTitle}`);
          console.log(`Container text sample: ${containerText.substring(0, 500)}...`);
          
          // より詳細なデバッグのため、HTML構造も確認
          if (containerText.length < 100) {
            console.log(`Container HTML: ${containerHtml.substring(0, 300)}...`);
          }
          
          // 家賃を抽出（スマイティの構造に特化）
          let price = this.extractSumaityPrice(containerText);
          
          // 間取りを抽出
          let layout = this.extractSumaityLayout(containerText);
          
          // 面積を抽出
          let area = this.extractSumaityArea(containerText);
          
          // 住所を抽出（より正確なパターンと正規化）
          let address = this.extractSumaityAddress(containerText);
          
          console.log(`Address extracted: "${address}"`);
          
          // 駅・アクセス情報を抽出
          const access: string[] = [];
          const stationMatches = containerText.match(/[^\n]*線[^\n]*駅[^\n]*徒歩\d+分/g);
          if (stationMatches) {
            access.push(...stationMatches.slice(0, 3));
          }
          
          // 画像URLを抽出
          let imageUrl = '';
          const imageElement = $container.find('img').first();
          if (imageElement.length > 0) {
            const src = imageElement.attr('src');
            if (src && src.startsWith('http') && !src.includes('data:image') && 
                !src.includes('loader.gif') && !src.includes('logo.svg')) {
              imageUrl = src;
            } else if (src && src.startsWith('/')) {
              imageUrl = `https://sumaity.com${src}`;
            }
          }
          
          console.log(`Extracted - Title: ${cleanTitle}, Price: ${price}, Layout: ${layout}, Area: ${area}, Address: ${address}`);
          
          // 有効な物件データの条件をチェック
          if (cleanTitle && cleanTitle.length > 2 && 
              (price || layout || area) && // 価格、間取り、面積のいずれかがあること
              !cleanTitle.includes('検索') && !cleanTitle.includes('条件')) {
            
            const id = generatePropertyId(address, area || layout, price || cleanTitle);
            
            console.log(`🏠 Creating Sumaity property object:`, {
              title: cleanTitle,
              price: price || '不明',
              layout: layout || '不明',
              area: area || '不明',
              image_url: imageUrl || 'undefined',
              has_image: !!imageUrl
            });
            
            properties.push({
              id,
              url: fullUrl,
              title: cleanTitle,
              price: price || '不明',
              address,
              layout: layout || '不明',
              area: area || '不明',
              building_type: 'apartment',
              access,
              image_url: imageUrl || undefined
            });
          }
        } catch (err) {
          console.error('Error parsing Sumaity property:', err);
        }
      });

      // 重複を除去
      const uniqueProperties = properties.filter((property, index, self) => 
        index === self.findIndex(p => p.title === property.title && p.address === property.address)
      );

      const propertiesWithImages = uniqueProperties.filter(p => p.image_url);
      console.log(`Sumaity Total properties extracted: ${uniqueProperties.length}`);
      console.log(`Sumaity Properties with images: ${propertiesWithImages.length}`);
      if (uniqueProperties.length > 0) {
        console.log(`Sumaity Image success rate: ${((propertiesWithImages.length / uniqueProperties.length) * 100).toFixed(1)}%`);
      }
      
      return uniqueProperties;
    } catch (error) {
      console.error(`Error scraping Sumaity ${url}:`, error);
      return [];
    }
  }

  private extractSumaityPrice(containerText: string): string {
    let price = '';
    
    // デバッグ: 価格を含むテキストセクションを特定
    const textSections = containerText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    console.log('Text sections containing 万円:', textSections.filter(s => s.includes('万円')));
    
    const pricePatterns = [
      // 基本的な万円パターン
      /(\d+(?:\.\d+)?)\s*万円/g,
      // 千円を含むパターン  
      /(\d+)万(\d+)千円/g,
      // 賃料表記
      /賃料[：:\s]*(\d+(?:\.\d+)?)\s*万円/g,
      // 家賃表記
      /家賃[：:\s]*(\d+(?:\.\d+)?)\s*万円/g
    ];
    
    // 全てのマッチを収集して、最初の有効な価格を使用
    for (const pattern of pricePatterns) {
      pattern.lastIndex = 0; // グローバルフラグのリセット
      const matches = [...containerText.matchAll(pattern)];
      console.log(`Pattern ${pattern.source} found matches:`, matches.map(m => m[0]));
      
      for (const match of matches) {
        if (match[2]) {
          // "25万8千円" のような形式
          const mainAmount = parseInt(match[1]);
          const subAmount = parseInt(match[2]);
          price = `${mainAmount + (subAmount / 10)}.万円`;
          break;
        } else if (match[1]) {
          // 価格が敷金礼金でないことを確認
          const beforeText = containerText.substring(Math.max(0, match.index! - 20), match.index!);
          const afterText = containerText.substring(match.index! + match[0].length, match.index! + match[0].length + 20);
          
          if (!beforeText.includes('敷') && !beforeText.includes('礼') && 
              !afterText.includes('敷') && !afterText.includes('礼')) {
            price = `${match[1]}万円`;
            break;
          }
        }
      }
      if (price) break;
    }
    
    return price;
  }

  private extractSumaityLayout(containerText: string): string {
    const layoutPatterns = [
      /(\d+[SLDK]+)/,
      /間取り[：:]\s*(\d+[SLDK]+)/,
      /(ワンルーム)/,
      /(1R)/
    ];
    
    for (const pattern of layoutPatterns) {
      const match = containerText.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return '';
  }

  private extractSumaityArea(containerText: string): string {
    const areaPatterns = [
      /専有面積[：:]\s*([\d.]+)m[²2]/,
      /([\d.]+)m[²2]/,
      /面積[：:]\s*([\d.]+)/
    ];
    
    for (const pattern of areaPatterns) {
      const match = containerText.match(pattern);
      if (match) {
        return pattern.source.includes('m') ? match[1] + 'm²' : match[1] + 'm²';
      }
    }
    
    return '';
  }

  private extractSumaityAddress(containerText: string): string {
    const addressPatterns = [
      // 完全な住所パターン（丁目まで含む）
      /(東京都|神奈川県|埼玉県|千葉県)[^\n]*?[区市町村][^\n]*?[０-９0-9]+丁目/,
      // 丁だけの場合も許可
      /(東京都|神奈川県|埼玉県|千葉県)[^\n]*?[区市町村][^\n]*?[０-９0-9]+丁/,
      // 番地まで含む場合
      /(東京都|神奈川県|埼玉県|千葉県)[^\n]*?[区市町村][^\n]*?[０-９0-9]+[-−][０-９0-9]+/,
      // 基本パターン
      /(東京都|神奈川県|埼玉県|千葉県)[^\n]*?[区市町村][^\n]*/,
      /(東京都|神奈川県|埼玉県|千葉県)[^。\n]*[区市町村]/
    ];
    
    for (const pattern of addressPatterns) {
      const match = containerText.match(pattern);
      if (match) {
        let address = match[0].trim();
        // 住所の正規化
        address = cleanupAddress(address);
        
        // 丁目レベルまでに正規化
        address = normalizeAddress(address);
        
        return address;
      }
    }
    
    return '';
  }
}