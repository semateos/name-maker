import https from 'https';
import { AppStoreResult } from '../types';

interface ITunesSearchResult {
  resultCount: number;
  results: Array<{
    trackName: string;
    bundleId: string;
    trackId: number;
    trackViewUrl: string;
  }>;
}

async function fetchJSON(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'NameMaker/1.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function checkiOSAppStore(name: string): Promise<AppStoreResult> {
  try {
    const searchTerm = encodeURIComponent(name);
    const url = `https://itunes.apple.com/search?term=${searchTerm}&entity=software&limit=10`;

    const response = await fetchJSON(url);
    const data = JSON.parse(response) as ITunesSearchResult;

    if (data.resultCount > 0) {
      // Check for exact matches only
      const normalizedName = name.toLowerCase().replace(/\s+/g, '');
      const exactMatch = data.results.find(app => {
        const appName = app.trackName.toLowerCase().replace(/\s+/g, '');
        return appName === normalizedName;
      });

      if (exactMatch) {
        return {
          status: 'taken',
          existingApp: exactMatch.trackName,
          storeUrl: exactMatch.trackViewUrl
        };
      }

      // No exact match found
      return { status: 'available' };
    }

    return { status: 'available' };
  } catch {
    return { status: 'unknown' };
  }
}
