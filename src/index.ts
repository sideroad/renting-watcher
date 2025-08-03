import * as dotenv from 'dotenv';
import { SuumoScraper, NiftyScraper, GoodroomsScraper, RStoreScraper, YahooRealEstateScraper, SumaityScraper } from './scrapers';
import { Database } from './database';
import { SlackNotifier } from './slack';
import { URLS } from './config';
import { Property } from './types';

dotenv.config();

async function main() {
  try {
    console.log('Starting rental property watcher...');
    
    const suumoScraper = new SuumoScraper();
    const niftyScraper = new NiftyScraper();
    const goodroomsScraper = new GoodroomsScraper();
    const rstoreScraper = new RStoreScraper();
    const yahooScraper = new YahooRealEstateScraper();
    const sumaityScraper = new SumaityScraper();
    const database = new Database();
    const notifier = new SlackNotifier();

    await database.initializeDatabase();

    // Check for delete all flag
    const shouldDeleteAll = process.argv.includes('--delete-all');
    if (shouldDeleteAll) {
      console.log('Deleting all existing properties...');
      await database.deleteAllProperties();
    }

    // Separate URLs by domain
    const suumoUrls = URLS.filter(url => url.includes('suumo.jp'));
    const niftyUrls = URLS.filter(url => url.includes('myhome.nifty.com'));
    const goodroomsUrls = URLS.filter(url => url.includes('goodrooms.jp'));
    const rstoreUrls = URLS.filter(url => url.includes('r-store.jp'));
    const yahooUrls = URLS.filter(url => url.includes('realestate.yahoo.co.jp'));
    const sumaityUrls = URLS.filter(url => url.includes('sumaity.com'));
    
    // Parallel scraping for each domain
    const scrapePromises: Promise<Property[]>[] = [];
    
    if (suumoUrls.length > 0) {
      console.log(`Scraping ${suumoUrls.length} Suumo URLs...`);
      scrapePromises.push(suumoScraper.scrapeAll(suumoUrls));
    }
    
    if (niftyUrls.length > 0) {
      console.log(`Scraping ${niftyUrls.length} Nifty URLs...`);
      scrapePromises.push(niftyScraper.scrapeAll(niftyUrls));
    }
    
    if (goodroomsUrls.length > 0) {
      console.log(`Scraping ${goodroomsUrls.length} Goodrooms URLs...`);
      scrapePromises.push(goodroomsScraper.scrapeAll(goodroomsUrls));
    }
    
    if (rstoreUrls.length > 0) {
      console.log(`Scraping ${rstoreUrls.length} R-Store URLs...`);
      scrapePromises.push(rstoreScraper.scrapeAll(rstoreUrls));
    }
    
    if (yahooUrls.length > 0) {
      console.log(`Scraping ${yahooUrls.length} Yahoo Real Estate URLs...`);
      scrapePromises.push(yahooScraper.scrapeAll(yahooUrls));
    }
    
    if (sumaityUrls.length > 0) {
      console.log(`Scraping ${sumaityUrls.length} Sumaity URLs...`);
      scrapePromises.push(sumaityScraper.scrapeAll(sumaityUrls));
    }
    
    // Execute all scrapers in parallel
    const propertiesArrays = await Promise.allSettled(scrapePromises);
    
    // Collect all successful results
    const allProperties: Property[] = [];
    propertiesArrays.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allProperties.push(...result.value);
      } else {
        console.error(`Scraper ${index} failed:`, result.reason);
      }
    });
    
    console.log(`Found ${allProperties.length} total properties`);

    const newProperties = await database.findNewProperties(allProperties);
    console.log(`Found ${newProperties.length} new properties`);

    if (newProperties.length > 0) {
      const savedProperties = await database.saveNewProperties(newProperties);
      console.log(`Saved ${savedProperties.length} new properties to database`);
      
      await notifier.notifyNewProperties(savedProperties);
    }

    console.log('Rental property watcher completed successfully');
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

main();