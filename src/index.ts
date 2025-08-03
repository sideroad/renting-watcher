import * as dotenv from 'dotenv';
import { SuumoScraper } from './scraper';
import { Database } from './database';
import { SlackNotifier } from './slack';
import { URLS } from './config';

dotenv.config();

async function main() {
  try {
    console.log('Starting rental property watcher...');
    
    const scraper = new SuumoScraper();
    const database = new Database();
    const notifier = new SlackNotifier();

    await database.initializeDatabase();

    console.log(`Scraping ${URLS.length} URLs...`);
    const allProperties = await scraper.scrapeAll(URLS);
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