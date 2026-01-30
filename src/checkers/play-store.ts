import https from 'https';
import { AppStoreResult } from '../types';

async function fetchHTML(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    https.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          fetchHTML(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function checkGooglePlayStore(name: string): Promise<AppStoreResult> {
  try {
    const searchTerm = encodeURIComponent(name);
    const url = `https://play.google.com/store/search?q=${searchTerm}&c=apps`;

    const html = await fetchHTML(url);

    // Look for app titles in the response
    // The Play Store uses various patterns for app names
    const normalizedName = name.toLowerCase().replace(/\s+/g, '');

    // Check if the page contains apps with similar names
    // Look for common patterns in Play Store HTML
    const titleMatches = html.match(/aria-label="([^"]+)"/g) || [];

    for (const match of titleMatches) {
      const titleMatch = match.match(/aria-label="([^"]+)"/);
      if (titleMatch) {
        const appTitle = titleMatch[1].toLowerCase().replace(/\s+/g, '');
        if (appTitle === normalizedName || appTitle.startsWith(normalizedName)) {
          return {
            status: 'taken',
            existingApp: titleMatch[1]
          };
        }
      }
    }

    // Also check for data-docid patterns which contain app package names
    if (html.includes(`"${name}"`) || html.includes(`>${name}<`)) {
      return { status: 'taken' };
    }

    return { status: 'available' };
  } catch {
    return { status: 'unknown' };
  }
}
