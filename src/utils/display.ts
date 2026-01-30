import chalk from 'chalk';
import Table from 'cli-table3';
import { NameCheckResult, TrademarkStatus, AvailabilityStatus, DomainResult, AppStoreResult } from '../types';

// Create a clickable terminal hyperlink (OSC 8)
function terminalLink(text: string, url: string): string {
  // OSC 8 hyperlink format: \x1b]8;;URL\x07TEXT\x1b]8;;\x07
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

function getTrademarkSearchUrl(name: string): string {
  return `https://tmsearch.uspto.gov/search/search-results?searchTerm=${encodeURIComponent(name)}`;
}

function getAppStoreSearchUrl(name: string): string {
  return `https://apps.apple.com/us/search?term=${encodeURIComponent(name)}`;
}

function getPlayStoreSearchUrl(name: string): string {
  return `https://play.google.com/store/search?q=${encodeURIComponent(name)}&c=apps`;
}

function formatTrademarkStatus(status: TrademarkStatus, name: string): string {
  const url = getTrademarkSearchUrl(name);
  let text: string;

  switch (status) {
    case 'AVAILABLE':
      text = chalk.green('✓ AVAIL');
      break;
    case 'PENDING':
      text = chalk.yellow('⚠ PENDING');
      break;
    case 'REGISTERED':
      text = chalk.red('✗ REG');
      break;
    default:
      text = chalk.gray('? UNKNOWN');
  }

  return terminalLink(text, url);
}

function formatAppStatus(result: AppStoreResult, name: string, store: 'ios' | 'play'): string {
  let text: string;

  switch (result.status) {
    case 'available':
      text = chalk.green('✓ Available');
      break;
    case 'taken':
      text = chalk.red('✗ Taken');
      break;
    default:
      text = chalk.gray('? Unknown');
  }

  // Make it a clickable link if taken
  if (result.status === 'taken') {
    // Use existing storeUrl or generate a search URL as fallback
    const url = result.storeUrl ||
      (store === 'ios' ? getAppStoreSearchUrl(name) : getPlayStoreSearchUrl(name));
    return terminalLink(text, url);
  }

  return text;
}

function formatDomains(domains: DomainResult[]): string {
  // Prioritize showing: .com first, then available domains, then others
  const comDomain = domains.find(d => d.domain.endsWith('.com'));
  const availableDomains = domains.filter(d => d.available && !d.domain.endsWith('.com'));
  const takenDomains = domains.filter(d => !d.available && !d.domain.endsWith('.com'));

  const orderedDomains = [
    ...(comDomain ? [comDomain] : []),
    ...availableDomains.slice(0, 8),
    ...takenDomains.slice(0, 3)
  ].slice(0, 12);

  return orderedDomains
    .map(d => {
      const tld = d.domain.includes('.') ? d.domain.substring(d.domain.lastIndexOf('.')) : d.domain;
      const icon = d.available ? chalk.green('✓') : chalk.red('✗');
      return `${tld}${icon}`;
    })
    .join(' ');
}

export function displayResults(results: NameCheckResult[]): void {
  const table = new Table({
    head: [
      chalk.white.bold('Name'),
      chalk.white.bold('Trademark'),
      chalk.white.bold('iOS App'),
      chalk.white.bold('Google Play'),
      chalk.white.bold('Domains')
    ],
    style: {
      head: [],
      border: []
    },
    colWidths: [16, 12, 13, 13, 56]
  });

  for (const result of results) {
    table.push([
      chalk.cyan.bold(result.name),
      formatTrademarkStatus(result.trademark.status, result.name),
      formatAppStatus(result.iosAppStore, result.name, 'ios'),
      formatAppStatus(result.googlePlayStore, result.name, 'play'),
      formatDomains(result.domains)
    ]);
  }

  console.log('\n' + table.toString() + '\n');
}

export function displayResultsHeader(): void {
  const header = new Table({
    head: [
      chalk.white.bold('Name'),
      chalk.white.bold('Trademark'),
      chalk.white.bold('iOS App'),
      chalk.white.bold('Google Play'),
      chalk.white.bold('Domains')
    ],
    style: {
      head: [],
      border: []
    },
    colWidths: [16, 12, 13, 13, 56]
  });

  console.log('\n' + header.toString().split('\n').slice(0, 3).join('\n'));
}

export function displayResultRow(result: NameCheckResult): void {
  const row = new Table({
    style: {
      head: [],
      border: []
    },
    colWidths: [16, 12, 13, 13, 56]
  });

  row.push([
    chalk.cyan.bold(result.name),
    formatTrademarkStatus(result.trademark.status, result.name),
    formatAppStatus(result.iosAppStore, result.name, 'ios'),
    formatAppStatus(result.googlePlayStore, result.name, 'play'),
    formatDomains(result.domains)
  ]);

  // Print just the data row (skip header lines)
  const lines = row.toString().split('\n');
  console.log(lines.slice(1, -1).join('\n'));
}

export function displayResultsFooter(): void {
  const footer = new Table({
    style: {
      head: [],
      border: []
    },
    colWidths: [16, 12, 13, 13, 56]
  });

  // Print just the bottom border
  console.log(footer.toString().split('\n')[0] + '\n');
}

export function displaySummary(results: NameCheckResult[]): void {
  console.log(chalk.bold('\n📊 Summary:\n'));

  // Find best candidates (most availability)
  const scored = results.map(r => {
    let score = 0;
    if (r.trademark.status === 'AVAILABLE') score += 3;
    if (r.iosAppStore.status === 'available') score += 2;
    if (r.googlePlayStore.status === 'available') score += 2;
    const availableDomains = r.domains.filter(d => d.available).length;
    score += availableDomains;
    return { name: r.name, score, result: r };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score > 0) {
    console.log(chalk.green(`   Best candidate: ${chalk.bold(best.name)}`));

    const availableDomains = best.result.domains
      .filter(d => d.available)
      .map(d => d.domain);

    if (availableDomains.length > 0) {
      console.log(chalk.gray(`   Available domains: ${availableDomains.join(', ')}`));
    }
  }

  // Show all fully available names
  const fullyAvailable = scored.filter(s =>
    s.result.trademark.status === 'AVAILABLE' &&
    s.result.iosAppStore.status === 'available' &&
    s.result.googlePlayStore.status === 'available' &&
    s.result.domains.some(d => d.domain.endsWith('.com') && d.available)
  );

  if (fullyAvailable.length > 0) {
    console.log(chalk.green.bold(`\n   🎯 Fully available (including .com): ${fullyAvailable.map(f => f.name).join(', ')}`));
  }

  console.log('');
}

export function displaySingleResult(result: NameCheckResult): void {
  console.log(chalk.bold(`\n📋 Results for "${chalk.cyan(result.name)}":\n`));

  // Trademark (with link to USPTO search)
  const tmUrl = getTrademarkSearchUrl(result.name);
  const tmIcon = result.trademark.status === 'AVAILABLE' ? chalk.green('✓') :
                 result.trademark.status === 'PENDING' ? chalk.yellow('⚠') :
                 result.trademark.status === 'REGISTERED' ? chalk.red('✗') : chalk.gray('?');
  const tmText = `${tmIcon} ${result.trademark.status}${result.trademark.details ? chalk.gray(` (${result.trademark.details})`) : ''}`;
  console.log(`   Trademark:    ${terminalLink(tmText, tmUrl)}`);

  // iOS App Store
  const iosIcon = result.iosAppStore.status === 'available' ? chalk.green('✓') :
                  result.iosAppStore.status === 'taken' ? chalk.red('✗') : chalk.gray('?');
  const iosText = `${iosIcon} ${result.iosAppStore.status}${result.iosAppStore.existingApp ? chalk.gray(` (${result.iosAppStore.existingApp})`) : ''}`;
  const iosUrl = result.iosAppStore.storeUrl || (result.iosAppStore.status === 'taken' ? getAppStoreSearchUrl(result.name) : null);
  const iosOutput = iosUrl ? terminalLink(iosText, iosUrl) : iosText;
  console.log(`   iOS App:      ${iosOutput}`);

  // Google Play
  const gpIcon = result.googlePlayStore.status === 'available' ? chalk.green('✓') :
                 result.googlePlayStore.status === 'taken' ? chalk.red('✗') : chalk.gray('?');
  const gpText = `${gpIcon} ${result.googlePlayStore.status}${result.googlePlayStore.existingApp ? chalk.gray(` (${result.googlePlayStore.existingApp})`) : ''}`;
  const gpUrl = result.googlePlayStore.storeUrl || (result.googlePlayStore.status === 'taken' ? getPlayStoreSearchUrl(result.name) : null);
  const gpOutput = gpUrl ? terminalLink(gpText, gpUrl) : gpText;
  console.log(`   Google Play:  ${gpOutput}`);

  // Domains
  console.log(`   Domains:`);
  for (const domain of result.domains) {
    const icon = domain.available ? chalk.green('✓') : chalk.red('✗');
    const status = domain.available ? 'available' : 'taken';
    console.log(`      ${icon} ${domain.domain} - ${status}`);
  }

  // Overall assessment
  const score = calculateScore(result);
  const assessment = score >= 10 ? chalk.green.bold('Excellent candidate!') :
                     score >= 6 ? chalk.yellow('Good potential') :
                     chalk.red('May have conflicts');
  console.log(`\n   Overall: ${assessment}\n`);
}

function calculateScore(result: NameCheckResult): number {
  let score = 0;
  if (result.trademark.status === 'AVAILABLE') score += 3;
  if (result.iosAppStore.status === 'available') score += 2;
  if (result.googlePlayStore.status === 'available') score += 2;
  const availableDomains = result.domains.filter(d => d.available).length;
  score += availableDomains;
  return score;
}

export function displayError(message: string): void {
  console.error(chalk.red(`\n❌ Error: ${message}\n`));
}

export function displayInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}
