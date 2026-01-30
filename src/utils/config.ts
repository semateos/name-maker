import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.name-maker');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
  anthropicApiKey?: string;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Return empty config if file doesn't exist or is invalid
  }
  return {};
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getApiKey(): string | undefined {
  // First check environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  // Then check config file
  const config = loadConfig();
  return config.anthropicApiKey;
}

export function saveApiKey(apiKey: string): void {
  const config = loadConfig();
  config.anthropicApiKey = apiKey;
  saveConfig(config);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}
