import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { TrademarkResult, TrademarkStatus } from '../types';

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

const USPTO_SEARCH_URL = 'https://tmsearch.uspto.gov/search/search-information';

// Reusable browser instance
let browserInstance: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance;
  }

  if (browserPromise) {
    return browserPromise;
  }

  browserPromise = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  }) as Promise<Browser>;

  browserInstance = await browserPromise;
  browserPromise = null;
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

interface TrademarkSearchResult {
  serialNumber: string;
  wordMark: string;
  status: string;
  isLive: boolean;
  isRegistered: boolean;
  isPending: boolean;
  internationalClass: string;
  goodsServices: string;
  owner?: string;
}

async function searchUSPTO(name: string): Promise<{ results: TrademarkSearchResult[]; totalCount: number }> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: 1920, height: 1080 });

    // Shorter initial delay
    await new Promise(r => setTimeout(r, 300 + Math.random() * 500));

    await page.goto(USPTO_SEARCH_URL, { waitUntil: 'domcontentloaded' });

    // Wait for search input
    await page.waitForSelector('#searchbar', { timeout: 10000 });

    // Type search term (faster typing)
    await page.type('#searchbar', name, { delay: 20 });

    // Click search
    await page.click('button.btn.btn-primary.md-icon');

    // Wait for results to load
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes('results for') ||
               text.includes('0 results') ||
               text.includes('403') ||
               text.includes('something went wrong');
      },
      { timeout: 15000 }
    ).catch(() => {});

    // Brief pause for page to stabilize
    await new Promise(r => setTimeout(r, 500));

    // Check for error page
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('403') || pageText.includes('permission') || pageText.includes('something went wrong')) {
      return { results: [], totalCount: -1 };
    }

    // Check for results
    const resultsMatch = pageText.match(/(\d+(?:,\d+)*)\s+results?\s+for/i);
    if (!resultsMatch) {
      if (pageText.includes('0 results') || pageText.toLowerCase().includes('no results')) {
        return { results: [], totalCount: 0 };
      }
      return { results: [], totalCount: -1 };
    }

    const initialCount = resultsMatch[1];

    // Uncheck "Dead" filter
    const deadCheckbox = await page.$('#statusDead');
    if (deadCheckbox) {
      await deadCheckbox.click();
      await page.waitForFunction(
        (prevCount: string) => {
          const text = document.body.innerText;
          const match = text.match(/(\d+(?:,\d+)*)\s+results?\s+for/i);
          return (match && match[1] !== prevCount) || text.includes('0 results');
        },
        { timeout: 8000 },
        initialCount
      ).catch(() => {});
      await new Promise(r => setTimeout(r, 300));
    }

    // Extract results with class and description
    const data = await page.evaluate(() => {
      const text = document.body.innerText;

      if (text.includes('0 results')) {
        return { results: [], totalCount: 0 };
      }

      const totalMatch = text.match(/(\d+(?:,\d+)*)\s+results?\s+for/i);
      const totalCount = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : 0;

      const results: Array<{
        serialNumber: string;
        wordMark: string;
        status: string;
        isLive: boolean;
        isRegistered: boolean;
        isPending: boolean;
        internationalClass: string;
        goodsServices: string;
        owner?: string;
      }> = [];

      // Split by serial number pattern
      const sections = text.split(/Check to tag for (\d{8})/);

      for (let i = 1; i < sections.length && results.length < 10; i += 2) {
        const serial = sections[i];
        const content = sections[i + 1] || '';

        // Extract wordmark
        const wordmarkMatch = content.match(/Wordmark\s*wordmark\s*([A-Z][A-Z0-9\s'&-]*?)\s*Status/i);
        const wordMark = wordmarkMatch ? wordmarkMatch[1].trim() : '';

        // Extract status
        const statusMatch = content.match(/(LIVE|DEAD)(REGISTERED|PENDING|CANCELLED|ABANDONED)/i);
        const status = statusMatch ? statusMatch[0] : '';
        const isLive = status.toUpperCase().includes('LIVE');
        const isRegistered = status.toUpperCase().includes('REGISTERED');
        const isPending = status.toUpperCase().includes('PENDING');

        // Extract International Class (IC XXX or Class XXX)
        const classMatch = content.match(/(?:IC|Class)\s*(\d{3})/i);
        const internationalClass = classMatch ? classMatch[1] : '';

        // Extract Goods & services description
        const goodsMatch = content.match(/Goods & services\s*(?:IC \d{3}:\s*)?\[?\s*([^\]]+?)(?:\]|\.|\s*Class|\s*Serial)/i);
        let goodsServices = goodsMatch ? goodsMatch[1].trim() : '';
        // Clean up and truncate
        goodsServices = goodsServices.replace(/\s+/g, ' ').slice(0, 100);
        if (goodsServices.length === 100) goodsServices += '...';

        // Extract owner
        const ownerMatch = content.match(/Owners?\s*([A-Za-z][A-Za-z0-9\s,.'&-]+?)(?:\s*\(|Check to tag)/i);
        const owner = ownerMatch ? ownerMatch[1].trim().slice(0, 50) : undefined;

        if (serial && wordMark) {
          results.push({
            serialNumber: serial,
            wordMark,
            status,
            isLive,
            isRegistered,
            isPending,
            internationalClass,
            goodsServices,
            owner
          });
        }
      }

      return { results, totalCount };
    });

    return data;

  } catch (err) {
    return { results: [], totalCount: -1 };
  } finally {
    await page.close();
  }
}

// Cache for trademark results (avoid re-checking same name)
const trademarkCache = new Map<string, TrademarkResult>();

export async function checkTrademark(name: string): Promise<TrademarkResult> {
  const normalizedName = name.toLowerCase().trim();

  // Check cache first
  const cached = trademarkCache.get(normalizedName);
  if (cached) {
    return cached;
  }

  try {
    const { results, totalCount } = await searchUSPTO(name);

    let result: TrademarkResult;

    if (totalCount === -1) {
      result = {
        status: 'UNKNOWN',
        details: 'Could not search USPTO (try again later)'
      };
    } else if (totalCount === 0) {
      result = {
        status: 'AVAILABLE',
        details: 'No live trademarks found in USPTO database'
      };
    } else if (results.length === 0 && totalCount > 0) {
      result = {
        status: 'PENDING',
        details: `${totalCount} live marks found (verify at USPTO)`
      };
    } else {
      // Check for exact matches
      const exactMatch = results.find(r =>
        r.wordMark.toLowerCase() === normalizedName && r.isLive
      );

      if (exactMatch) {
        const classInfo = exactMatch.internationalClass ? ` Class ${exactMatch.internationalClass}` : '';
        const goodsInfo = exactMatch.goodsServices ? `: ${exactMatch.goodsServices}` : '';

        if (exactMatch.isRegistered) {
          result = {
            status: 'REGISTERED',
            details: `Registered (SN: ${exactMatch.serialNumber})${classInfo}${goodsInfo}`
          };
        } else if (exactMatch.isPending) {
          result = {
            status: 'PENDING',
            details: `Pending (SN: ${exactMatch.serialNumber})${classInfo}${goodsInfo}`
          };
        } else {
          result = {
            status: 'PENDING',
            details: `${totalCount} live marks found`
          };
        }
      } else {
        // Check for similar live matches
        const similarLive = results.filter(r => {
          if (!r.isLive) return false;
          const mark = r.wordMark.toLowerCase();
          return mark.includes(normalizedName) || normalizedName.includes(mark);
        });

        if (similarLive.length > 0) {
          const registered = similarLive.filter(r => r.isRegistered);
          if (registered.length > 0) {
            const first = registered[0];
            const classInfo = first.internationalClass ? ` (Class ${first.internationalClass})` : '';
            const marks = registered.slice(0, 2).map(r => r.wordMark).join(', ');
            result = {
              status: 'PENDING',
              details: `Similar marks: ${marks}${classInfo} - ${totalCount} total live`
            };
          } else {
            result = {
              status: 'PENDING',
              details: `${totalCount} live marks found`
            };
          }
        } else {
          // Show what classes are occupied
          const liveResults = results.filter(r => r.isLive);
          const classes = [...new Set(liveResults.map(r => r.internationalClass).filter(c => c))];
          const classesStr = classes.length > 0 ? ` in classes: ${classes.slice(0, 5).join(', ')}` : '';

          result = {
            status: 'PENDING',
            details: `${totalCount} live marks found${classesStr}`
          };
        }
      }
    }

    // Cache successful results (not UNKNOWN)
    if (result.status !== 'UNKNOWN') {
      trademarkCache.set(normalizedName, result);
    }

    return result;

  } catch {
    return {
      status: 'UNKNOWN',
      details: 'Could not search USPTO database'
    };
  }
}

export function getTrademarkSearchUrl(name: string): string {
  return `https://tmsearch.uspto.gov/search/search-results?searchTerm=${encodeURIComponent(name)}`;
}

export function getTrademarkStatusSymbol(status: TrademarkStatus): string {
  switch (status) {
    case 'AVAILABLE': return '✓';
    case 'PENDING': return '⚠';
    case 'REGISTERED': return '✗';
    default: return '?';
  }
}
