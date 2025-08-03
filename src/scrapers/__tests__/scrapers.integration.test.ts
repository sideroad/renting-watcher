import { SuumoScraper, NiftyScraper, GoodroomsScraper, RStoreScraper, YahooRealEstateScraper, SumaityScraper } from '../index';

// Mock axios to avoid actual HTTP requests in tests
jest.mock('axios');

describe('Scrapers Integration', () => {
  describe('All scrapers', () => {
    it('should extend BaseScraper and have required methods', () => {
      const scrapers = [
        new SuumoScraper(),
        new NiftyScraper(),
        new GoodroomsScraper(),
        new RStoreScraper(),
        new YahooRealEstateScraper(),
        new SumaityScraper()
      ];

      scrapers.forEach(scraper => {
        expect(scraper).toHaveProperty('scrapeUrl');
        expect(scraper).toHaveProperty('scrapeAll');
        expect(typeof scraper.scrapeUrl).toBe('function');
        expect(typeof scraper.scrapeAll).toBe('function');
      });
    });

    it('should have consistent return type for scrapeUrl', async () => {
      const scrapers = [
        new SuumoScraper(),
        new NiftyScraper(),
        new GoodroomsScraper(),
        new RStoreScraper(),
        new YahooRealEstateScraper(),
        new SumaityScraper()
      ];

      // Mock axios to return empty response
      const mockAxios = require('axios');
      mockAxios.get.mockResolvedValue({ 
        data: '<html><body></body></html>' 
      });

      for (const scraper of scrapers) {
        const result = await scraper.scrapeUrl('https://example.com');
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual([]);
      }
    });

    it('should have consistent return type for scrapeAll', async () => {
      const scrapers = [
        new SuumoScraper(),
        new NiftyScraper(),
        new GoodroomsScraper(),
        new RStoreScraper(),
        new YahooRealEstateScraper(),
        new SumaityScraper()
      ];

      // Mock axios to return empty response
      const mockAxios = require('axios');
      mockAxios.get.mockResolvedValue({ 
        data: '<html><body></body></html>' 
      });

      for (const scraper of scrapers) {
        const result = await scraper.scrapeAll(['https://example.com']);
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual([]);
      }
    }, 15000); // 15 second timeout
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      const scraper = new SuumoScraper();
      
      // Mock axios to throw an error
      const mockAxios = require('axios');
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await scraper.scrapeUrl('https://invalid-url.com');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });

    it('should handle malformed HTML gracefully', async () => {
      const scraper = new SuumoScraper();
      
      // Mock axios to return malformed HTML
      const mockAxios = require('axios');
      mockAxios.get.mockResolvedValue({ 
        data: '<html><body><div>Malformed HTML without closing tags' 
      });

      const result = await scraper.scrapeUrl('https://example.com');
      expect(Array.isArray(result)).toBe(true);
      // Should not throw an error
    });
  });
});