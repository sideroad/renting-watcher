/**
 * Custom error classes for the scraping application
 */

export class ScrapingError extends Error {
  constructor(
    message: string,
    public url: string,
    public scraperName: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ScrapingError';
  }
}

export class NetworkError extends ScrapingError {
  constructor(url: string, scraperName: string, originalError: Error) {
    super(`Network error while scraping ${url}`, url, scraperName, originalError);
    this.name = 'NetworkError';
  }
}

export class ParseError extends ScrapingError {
  constructor(url: string, scraperName: string, originalError?: Error) {
    super(`Failed to parse content from ${url}`, url, scraperName, originalError);
    this.name = 'ParseError';
  }
}

/**
 * Retry utility function for handling temporary failures
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError!;
}

/**
 * Rate limiting utility to prevent overwhelming servers
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  
  constructor(private interval: number = 2000) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const operation = this.queue.shift()!;
      await operation();
      
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.interval));
      }
    }
    
    this.processing = false;
  }
}

/**
 * Safe property extraction with fallback values
 */
export function safeExtract<T>(
  extractor: () => T,
  fallback: T,
  context?: string
): T {
  try {
    const result = extractor();
    return result !== null && result !== undefined ? result : fallback;
  } catch (error) {
    if (context) {
      console.warn(`Failed to extract ${context}:`, error);
    }
    return fallback;
  }
}