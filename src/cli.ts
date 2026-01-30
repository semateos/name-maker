import { input, select, Separator } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import { UserInput, NameCheckResult, GeneratedName } from './types';
import { generateNames, generateMoreNames } from './generators/ai-generator';
import { checkTrademark, closeBrowser } from './checkers/trademark';
import { checkiOSAppStore } from './checkers/app-store';
import { checkGooglePlayStore } from './checkers/play-store';
import { checkDomains } from './checkers/domain';
import { displayResults, displaySummary, displayError, displaySingleResult, displayResultsHeader, displayResultRow, displayResultsFooter } from './utils/display';
import {
  Session,
  createSession,
  saveSession,
  loadSession,
  listSessions,
  formatSessionDate
} from './utils/sessions';

async function selectSession(): Promise<{ mode: 'new' | 'resume'; session?: Session }> {
  const sessions = listSessions();

  if (sessions.length === 0) {
    return { mode: 'new' };
  }

  const choices = [
    { name: chalk.green('+ Start a new session'), value: 'new' },
    new Separator(chalk.gray('─── Recent Sessions ───')),
    ...sessions.map(s => ({
      name: `${chalk.cyan(s.name)} ${chalk.gray(`(${formatSessionDate(s.updatedAt)} · ${s.results.length} names)`)}`,
      value: s.id
    }))
  ];

  const selection = await select({
    message: 'What would you like to do?',
    choices
  });

  if (selection === 'new') {
    return { mode: 'new' };
  }

  const session = loadSession(selection);
  if (session) {
    return { mode: 'resume', session };
  }

  console.log(chalk.yellow('Could not load session, starting new one.'));
  return { mode: 'new' };
}

async function promptUser(): Promise<UserInput> {
  console.log(chalk.bold('\n📋 Let\'s learn about your product\n'));

  // Step 1: Basic product info
  const productType = await select({
    message: 'What type of product is this?',
    choices: [
      { name: '📱 Mobile App', value: 'app' as const },
      { name: '💻 SaaS / Web Application', value: 'saas' as const },
      { name: '🌐 Website / Platform', value: 'website' as const },
      { name: '📦 Physical Product', value: 'physical' as const },
      { name: '🤝 Service / Agency', value: 'service' as const },
      { name: '🔷 Other', value: 'other' as const }
    ]
  });

  const description = await input({
    message: 'Describe what your product does:',
    validate: (value: string) => value.length > 10 || 'Please provide a more detailed description (at least 10 characters)'
  });

  const industry = await input({
    message: 'What industry or category? (e.g., fintech, health, education, gaming)',
    validate: (value: string) => value.length > 0 || 'Please specify an industry'
  });

  const targetAudience = await input({
    message: 'Who is your target audience? (e.g., developers, small businesses, students)',
    default: 'general consumers'
  });

  console.log(chalk.bold('\n🎨 Now let\'s define the name style\n'));

  // Step 2: Name style preferences
  const toneStyle = await select({
    message: 'What tone should the name convey?',
    choices: [
      { name: '🚀 Modern/Tech - innovative, cutting-edge, sleek', value: 'modern' as const },
      { name: '😊 Friendly - approachable, warm, welcoming', value: 'friendly' as const },
      { name: '👔 Professional - trustworthy, established, serious', value: 'professional' as const },
      { name: '🎉 Playful - fun, creative, energetic', value: 'playful' as const },
      { name: '✨ Luxurious - premium, exclusive, elegant', value: 'luxurious' as const },
      { name: '💪 Bold - strong, confident, powerful', value: 'bold' as const }
    ]
  });

  const nameStyle = await select({
    message: 'What type of name do you prefer?',
    choices: [
      { name: '📖 Real words - actual dictionary words (e.g., Slack, Apple, Square)', value: 'real-words' as const },
      { name: '✨ Invented words - made-up but memorable (e.g., Spotify, Kodak, Xerox)', value: 'invented' as const },
      { name: '🔗 Compound words - two words combined (e.g., Facebook, YouTube, Snapchat)', value: 'compound' as const },
      { name: '🎨 Abstract - evocative, non-literal (e.g., Amazon, Nike, Oracle)', value: 'abstract' as const },
      { name: '🎲 Any style - surprise me with variety', value: 'any' as const }
    ]
  });

  const nameLength = await select({
    message: 'Preferred name length?',
    choices: [
      { name: '⚡ Short (1-5 letters) - punchy and memorable', value: 'short' as const },
      { name: '📏 Medium (6-8 letters) - balanced', value: 'medium' as const },
      { name: '📜 Longer (9+ letters) - descriptive', value: 'long' as const },
      { name: '🎯 Any length - whatever works best', value: 'any' as const }
    ]
  });

  console.log(chalk.bold('\n💡 Help guide the creative direction\n'));

  // Step 3: Creative direction
  const keywordsInput = await input({
    message: 'Keywords to incorporate or draw inspiration from: (comma-separated, or press Enter to skip)',
    default: ''
  });

  const themesInput = await input({
    message: 'Themes or concepts to evoke: (e.g., speed, trust, creativity - comma-separated)',
    default: ''
  });

  const avoidWordsInput = await input({
    message: 'Any words or sounds to AVOID? (comma-separated, or press Enter to skip)',
    default: ''
  });

  const competitorsInput = await input({
    message: 'Competitor names to differentiate from: (comma-separated, or press Enter to skip)',
    default: ''
  });

  const parseList = (inputStr: string): string[] =>
    inputStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

  return {
    productType,
    description,
    industry,
    targetAudience,
    toneStyle,
    nameStyle,
    nameLength,
    keywords: parseList(keywordsInput),
    themes: parseList(themesInput),
    avoidWords: parseList(avoidWordsInput),
    competitors: parseList(competitorsInput)
  };
}

async function checkNameAvailability(name: string): Promise<NameCheckResult> {
  const [trademark, iosAppStore, googlePlayStore, domains] = await Promise.all([
    checkTrademark(name),
    checkiOSAppStore(name),
    checkGooglePlayStore(name),
    checkDomains(name)
  ]);

  return {
    name,
    trademark,
    iosAppStore,
    googlePlayStore,
    domains
  };
}

async function generateAndCheck(
  session: Session,
  feedback?: string
): Promise<{ names: GeneratedName[]; results: NameCheckResult[] }> {
  // Generate names
  const genSpinner = ora('Generating creative names with AI...').start();
  let names: GeneratedName[];

  try {
    // Collect all names from session (generated + manually checked)
    const allPreviousNames = [
      ...session.generatedNames,
      ...session.results.map(r => r.name)
    ];
    const uniquePreviousNames = [...new Set(allPreviousNames)];

    if (feedback || uniquePreviousNames.length > 0) {
      names = await generateMoreNames(session.input, uniquePreviousNames, feedback);
    } else {
      names = await generateNames(session.input);
    }
    genSpinner.succeed(`Generated ${names.length} name ideas`);
  } catch (error) {
    genSpinner.fail('Failed to generate names');
    throw error;
  }

  // Show generated names
  console.log(chalk.bold('\n💡 Generated Names:\n'));
  names.forEach((n, i) => {
    console.log(chalk.white(`   ${i + 1}. ${chalk.cyan.bold(n.name)}`));
    if (n.reasoning) {
      console.log(chalk.gray(`      ${n.reasoning}`));
    }
  });

  // Check availability - show results as they come in
  console.log(chalk.bold('\n📊 Checking availability...\n'));
  displayResultsHeader();

  const results: NameCheckResult[] = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i];

    let result: NameCheckResult;
    try {
      result = await checkNameAvailability(name.name);
    } catch {
      result = {
        name: name.name,
        trademark: { status: 'UNKNOWN' },
        iosAppStore: { status: 'unknown' },
        googlePlayStore: { status: 'unknown' },
        domains: []
      };
    }

    results.push(result);
    displayResultRow(result);
  }

  displayResultsFooter();
  console.log(chalk.green('✓ Availability check complete'));

  // Update session
  session.generatedNames.push(...names.map(n => n.name));
  session.results.push(...results);
  saveSession(session);

  return { names, results };
}

async function checkSpecificName(name: string, session: Session): Promise<void> {
  const spinner = ora(`Checking availability for "${name}"...`).start();

  try {
    const result = await checkNameAvailability(name);
    spinner.succeed(`Checked "${name}"`);
    displaySingleResult(result);

    // Add to session if not already there
    if (!session.results.find(r => r.name.toLowerCase() === name.toLowerCase())) {
      session.results.push(result);
      saveSession(session);
    }
  } catch (error) {
    spinner.fail(`Failed to check "${name}"`);
    if (error instanceof Error) {
      displayError(error.message);
    }
  }
}

function displaySessionSummary(session: Session): void {
  const userInput = session.input;
  console.log(chalk.bold('\n📝 Session Summary:\n'));
  console.log(chalk.gray(`   Product: ${userInput.productType} - ${userInput.description.slice(0, 50)}...`));
  console.log(chalk.gray(`   Industry: ${userInput.industry} | Audience: ${userInput.targetAudience}`));
  console.log(chalk.gray(`   Style: ${userInput.toneStyle} | Type: ${userInput.nameStyle} | Length: ${userInput.nameLength}`));
  if (userInput.keywords.length) console.log(chalk.gray(`   Keywords: ${userInput.keywords.join(', ')}`));
  if (userInput.themes.length) console.log(chalk.gray(`   Themes: ${userInput.themes.join(', ')}`));
  console.log(chalk.gray(`   Names generated: ${session.generatedNames.length}`));
}

async function interactiveLoop(session: Session): Promise<void> {
  while (true) {
    console.log(chalk.gray('\n' + '─'.repeat(50)));

    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: '🔄 Generate more names', value: 'generate' },
        { name: '🔄 Generate more names with feedback', value: 'generate-feedback' },
        { name: '🔍 Check a specific name', value: 'check' },
        { name: '📋 Show all results', value: 'show' },
        { name: '🏆 Show best candidates', value: 'best' },
        { name: '📝 Show session info', value: 'info' },
        { name: '👋 Exit', value: 'exit' }
      ]
    });

    switch (action) {
      case 'generate': {
        try {
          const { results } = await generateAndCheck(session);
          displaySummary(results);
        } catch (error) {
          if (error instanceof Error) {
            displayError(error.message);
          }
        }
        break;
      }

      case 'generate-feedback': {
        const feedback = await input({
          message: 'What direction should we take? (e.g., "more playful", "shorter names", "include \'tech\'"):',
          validate: (value: string) => value.length > 0 || 'Please provide some feedback'
        });

        try {
          const { results } = await generateAndCheck(session, feedback);
          displaySummary(results);
        } catch (error) {
          if (error instanceof Error) {
            displayError(error.message);
          }
        }
        break;
      }

      case 'check': {
        const namesToCheck = await input({
          message: 'Enter name(s) to check (comma-separated):',
          validate: (value: string) => value.length > 0 || 'Please enter at least one name'
        });

        const names = namesToCheck.split(',').map((n: string) => n.trim()).filter((n: string) => n.length > 0);

        for (const name of names) {
          await checkSpecificName(name, session);
        }
        break;
      }

      case 'show': {
        if (session.results.length === 0) {
          console.log(chalk.yellow('\nNo results to show yet.'));
        } else {
          displayResults(session.results);
        }
        break;
      }

      case 'best': {
        if (session.results.length === 0) {
          console.log(chalk.yellow('\nNo results to analyze yet.'));
        } else {
          displaySummary(session.results);
        }
        break;
      }

      case 'info': {
        displaySessionSummary(session);
        console.log(chalk.gray(`\n   Session ID: ${session.id}`));
        console.log(chalk.gray(`   Created: ${formatSessionDate(session.createdAt)}`));
        console.log(chalk.gray(`   Last updated: ${formatSessionDate(session.updatedAt)}`));
        break;
      }

      case 'exit': {
        console.log(chalk.cyan('\n👋 Session saved! You can resume it later.'));
        console.log(chalk.gray(`   Session: ${session.name}\n`));
        await closeBrowser();
        return;
      }
    }
  }
}

export async function runInteractive(): Promise<void> {
  console.log(chalk.bold.cyan('\n🏷️  Name Maker - AI-Powered Product Name Generator'));
  console.log(chalk.gray('━'.repeat(50)));

  try {
    // Session selection
    const { mode, session: existingSession } = await selectSession();

    let session: Session;

    if (mode === 'resume' && existingSession) {
      session = existingSession;
      console.log(chalk.green(`\n✓ Resumed session: ${session.name}`));
      displaySessionSummary(session);

      if (session.results.length > 0) {
        console.log(chalk.bold(`\n📊 Previous Results (${session.results.length} names):`));
        displayResults(session.results);
        displaySummary(session.results);
      }
    } else {
      // Get user input for new session
      const userInput = await promptUser();

      // Create session
      session = createSession(userInput);

      // Summary of inputs
      displaySessionSummary(session);

      // Initial generation
      console.log('');
      const { results } = await generateAndCheck(session);

      // Display summary (results already shown incrementally)
      displaySummary(results);
    }

    // Enter interactive loop
    await interactiveLoop(session);

  } catch (error) {
    if (error instanceof Error) {
      displayError(error.message);
    }
  }
}

export async function runWithArgs(
  description: string,
  keywords: string[],
  style: string
): Promise<void> {
  // Map simple args to full UserInput
  const validStyles = ['modern', 'friendly', 'professional', 'playful', 'luxurious', 'bold'];
  const selectedStyle = validStyles.includes(style)
    ? (style as UserInput['toneStyle'])
    : 'modern';

  const userInput: UserInput = {
    productType: 'other',
    description,
    industry: 'technology',
    targetAudience: 'general consumers',
    toneStyle: selectedStyle,
    nameStyle: 'any',
    nameLength: 'any',
    keywords,
    themes: [],
    avoidWords: [],
    competitors: []
  };

  console.log(chalk.bold.cyan('\n🏷️  Name Maker - AI-Powered Product Name Generator\n'));

  // Create session
  const session = createSession(userInput);

  // Initial generation
  const { results } = await generateAndCheck(session);

  // Display summary (results already shown incrementally)
  displaySummary(results);

  // Enter interactive loop
  await interactiveLoop(session);
}
