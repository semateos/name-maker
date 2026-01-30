import gplay from 'google-play-scraper';
import { AppStoreResult } from '../types';

export async function checkGooglePlayStore(name: string): Promise<AppStoreResult> {
  try {
    const normalizedName = name.toLowerCase().replace(/\s+/g, '');

    // Search for apps matching the name
    const results = await gplay.search({
      term: name,
      num: 10
    });

    if (results.length === 0) {
      return { status: 'available' };
    }

    // Check for exact matches only
    const exactMatch = results.find(app => {
      const appTitle = app.title.toLowerCase().replace(/\s+/g, '');
      return appTitle === normalizedName;
    });

    if (exactMatch) {
      // Convert /work/apps/ URL to /store/apps/ for public access
      const storeUrl = exactMatch.url.replace('/work/apps/', '/store/apps/');
      return {
        status: 'taken',
        existingApp: exactMatch.title,
        storeUrl
      };
    }

    // No exact match found
    return { status: 'available' };
  } catch {
    return { status: 'unknown' };
  }
}
