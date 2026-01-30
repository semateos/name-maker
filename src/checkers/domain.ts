import dns from 'dns';
import { promisify } from 'util';
import { DomainResult } from '../types';

const resolveDns = promisify(dns.resolve);

// TLDs to check, organized by category and priority
const TLDS = [
  // Essential
  '.com',
  // Tech & Startups
  '.io', '.co', '.ai', '.app', '.dev', '.tech', '.software',
  // Modern & Trendy
  '.so', '.to', '.gg', '.xyz', '.me', '.cc',
  // Business & Professional
  '.inc', '.company', '.agency', '.studio', '.works',
  // Industry Specific
  '.design', '.digital', '.cloud', '.tools', '.systems', '.games',
  // Short & Memorable
  '.sh', '.is', '.it', '.im', '.fm', '.tv', '.vc'
];

async function checkDomainDNS(domain: string): Promise<boolean> {
  try {
    await resolveDns(domain);
    // Domain resolves, so it's taken
    return false;
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    // ENOTFOUND means the domain doesn't resolve - could be available
    // ENODATA means no records but domain may still be registered
    if (err.code === 'ENOTFOUND') {
      return true; // Likely available
    }
    // Other errors - assume taken to be safe
    return false;
  }
}

function generateDomainHacks(name: string): string[] {
  const hacks: string[] = [];
  const lowerName = name.toLowerCase();

  // Common domain hack TLDs
  const hackTLDs: Record<string, string[]> = {
    'io': ['io'],
    'ly': ['ly'],
    'er': ['er'],
    'al': ['al'],
    'es': ['es'],
    'is': ['is'],
    'it': ['it'],
    'in': ['in'],
    'us': ['us'],
    'me': ['me'],
    'to': ['to'],
    'at': ['at'],
    'be': ['be'],
    'do': ['do'],
    'so': ['so']
  };

  // Check if name ends with a hackable TLD
  for (const [ending, tlds] of Object.entries(hackTLDs)) {
    if (lowerName.endsWith(ending) && lowerName.length > ending.length) {
      const prefix = lowerName.slice(0, -ending.length);
      for (const tld of tlds) {
        hacks.push(`${prefix}.${tld}`);
      }
    }
  }

  return hacks;
}

export async function checkDomains(name: string): Promise<DomainResult[]> {
  const results: DomainResult[] = [];
  const baseName = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check standard TLDs (limit to top 12 for speed)
  const tldsToCheck = TLDS.slice(0, 12);
  const standardChecks = tldsToCheck.map(async (tld): Promise<DomainResult> => {
    const domain = `${baseName}${tld}`;
    const available = await checkDomainDNS(domain);
    return { domain, available };
  });

  // Check domain hacks
  const domainHacks = generateDomainHacks(name);
  const hackChecks = domainHacks.slice(0, 2).map(async (domain): Promise<DomainResult> => {
    const available = await checkDomainDNS(domain);
    return { domain, available };
  });

  const allResults = await Promise.all([...standardChecks, ...hackChecks]);
  results.push(...allResults);

  return results;
}

export function formatDomainResults(results: DomainResult[]): string {
  return results
    .map(r => `${r.domain} ${r.available ? '✓' : '✗'}`)
    .join(' ');
}
