import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import { Property } from '../types';

export abstract class BaseScraper {
  protected userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  protected getRequestConfig() {
    return {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      }
    };
  }

  abstract scrapeUrl(url: string): Promise<Property[]>;

  async scrapeAll(urls: string[]): Promise<Property[]> {
    const allProperties: Property[] = [];
    
    for (const url of urls) {
      console.log(`\nScraping URL: ${url}`);
      
      try {
        const properties = await this.scrapeWithPagination(url);
        allProperties.push(...properties);
        console.log(`Found ${properties.length} properties from ${url}`);
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }
      
      // Add delay between URLs to avoid rate limiting
      if (urls.indexOf(url) < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Deduplicate properties based on ID
    return this.deduplicateProperties(allProperties);
  }
  
  protected async scrapeWithPagination(url: string, maxPages: number = 10): Promise<Property[]> {
    const allProperties: Property[] = [];
    let currentUrl = url;
    let pageCount = 1;
    
    while (currentUrl && pageCount <= maxPages) {
      console.log(`Scraping page ${pageCount}: ${currentUrl}`);
      
      const pageResult = await this.scrapePageWithNext(currentUrl);
      allProperties.push(...pageResult.properties);
      
      if (!pageResult.nextUrl || pageCount >= maxPages) {
        break;
      }
      
      currentUrl = pageResult.nextUrl;
      pageCount++;
      
      // Add delay between pages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`Scraped ${pageCount} page(s), found ${allProperties.length} properties total`);
    return allProperties;
  }
  
  protected async scrapePageWithNext(url: string): Promise<{ properties: Property[], nextUrl?: string }> {
    // Default implementation - subclasses can override for pagination support
    const properties = await this.scrapeUrl(url);
    return { properties };
  }

  protected deduplicateProperties(properties: Property[]): Property[] {
    const seen = new Set<string>();
    return properties.filter(property => {
      if (seen.has(property.id)) {
        return false;
      }
      seen.add(property.id);
      return true;
    });
  }

  protected extractImageUrl($element: any, baseUrl?: string): string | undefined {
    // Try various methods to extract image URL
    let imageUrl = 
      $element.find('img').first().attr('src') ||
      $element.find('img').first().attr('data-src') ||
      $element.find('img').first().attr('data-original') ||
      $element.find('[data-src]').first().attr('data-src') ||
      $element.find('[data-original]').first().attr('data-original');
    
    // Check for background image
    if (!imageUrl) {
      imageUrl = this.extractBackgroundImage($element);
    }
    
    // Convert relative URLs to absolute
    if (imageUrl && baseUrl) {
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = baseUrl + imageUrl;
      }
    }
    
    return imageUrl || undefined;
  }

  protected extractBackgroundImage($element: any): string | undefined {
    // Try to extract background image from style attribute
    const styleAttr = $element.find('[style*="background-image"]').first().attr('style');
    if (styleAttr) {
      const match = styleAttr.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (match && match[1]) {
        let url = match[1];
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }
        return url;
      }
    }
    return undefined;
  }
}