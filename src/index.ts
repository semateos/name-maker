#!/usr/bin/env node

import { Command } from 'commander';
import { runInteractive, runWithArgs } from './cli';
import { ensureAuthenticated } from './auth';

async function main() {
  const program = new Command();

  program
    .name('name-maker')
    .description('AI-powered product name generator with availability checking')
    .version('1.0.0');

  program
    .option('-d, --description <text>', 'Product description')
    .option('-k, --keywords <words>', 'Comma-separated keywords')
    .option('-s, --style <style>', 'Style: modern, friendly, professional, playful', 'modern')
    .action(async (options) => {
      // Ensure API key is configured before proceeding
      const apiKey = await ensureAuthenticated();
      if (!apiKey) {
        process.exit(1);
      }

      // Set the API key in environment for the Anthropic SDK
      process.env.ANTHROPIC_API_KEY = apiKey;

      if (options.description) {
        // Run with command-line arguments
        const keywords = options.keywords
          ? options.keywords.split(',').map((k: string) => k.trim())
          : [];
        await runWithArgs(options.description, keywords, options.style);
      } else {
        // Run interactive mode
        await runInteractive();
      }
    });

  program.parse();
}

main();
