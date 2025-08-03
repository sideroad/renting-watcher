import * as dotenv from 'dotenv';
import { SuumoScraper, NiftyScraper } from './scraper';
import { Database } from './database';
import { SlackNotifier } from './slack';
import { URLS } from './config';

dotenv.config();

async function main() {
  try {
    console.log('Starting rental property watcher...');
    
    const suumoScraper = new SuumoScraper();
    const niftyScraper = new NiftyScraper();
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
    
    console.log(`Scraping ${suumoUrls.length} Suumo URLs...`);
    const suumoProperties = suumoUrls.length > 0 ? await suumoScraper.scrapeAll(suumoUrls) : [];
    
    console.log(`Scraping ${niftyUrls.length} Nifty URLs...`);
    const niftyProperties = niftyUrls.length > 0 ? await niftyScraper.scrapeAll(niftyUrls) : [];
    
    const allProperties = [...suumoProperties, ...niftyProperties];
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