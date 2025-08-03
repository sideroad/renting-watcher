import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import { Property } from '../types';

export abstract class BaseScraper {
  protected userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  
  protected getRequestConfig(): AxiosRequestConfig {
    return {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };
  }

  abstract scrapeUrl(url: string): Promise<Property[]>;

  async scrapeAll(urls: string[]): Promise<Property[]> {
    const allProperties: Property[] = [];
    
    // Process URLs in batches to control concurrency
    const batchSize = 3; // Process 3 URLs at a time
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (url) => {
        console.log(`Scraping ${this.constructor.name} URL: ${url}`);
        try {
          const properties = await this.scrapeUrl(url);
          return properties;
        } catch (error) {
          console.error(`Error scraping ${url}:`, error);
          return [];
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(properties => allProperties.push(...properties));
      
      // Rate limiting between batches (not after the last batch)
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return this.deduplicateProperties(allProperties);
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

  protected extractImageUrl($element: cheerio.Cheerio<cheerio.Element>, baseUrl: string): string {
    const imageElement = $element.find('img').first();
    if (imageElement.length === 0) return '';

    // Common image attributes to check
    const attributes = ['src', 'data-src', 'data-original', 'rel'];
    
    for (const attr of attributes) {
      const value = imageElement.attr(attr);
      if (value && value.startsWith('http') && !value.includes('data:image')) {
        return value;
      }
    }

    // Check for relative URLs
    for (const attr of attributes) {
      const value = imageElement.attr(attr);
      if (value && value.startsWith('/') && !value.includes('data:image')) {
        return `${baseUrl}${value}`;
      }
    }

    return '';
  }

  protected extractBackgroundImage($element: cheerio.Cheerio<cheerio.Element>, baseUrl: string): string {
    let imageUrl = '';
    
    $element.find('*').each((_: number, el: cheerio.Element) => {
      const $el = $element.constructor(el) as cheerio.Cheerio<cheerio.Element>;
      const style = $el.attr('style');
      if (style && style.includes('background-image')) {
        const match = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
        if (match && match[1] && !match[1].includes('data:image')) {
          imageUrl = match[1].startsWith('http') ? match[1] : `${baseUrl}${match[1]}`;
          return false; // break
        }
      }
    });
    
    return imageUrl;
  }
}