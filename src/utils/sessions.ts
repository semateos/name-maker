import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserInput, NameCheckResult } from '../types';

const SESSIONS_DIR = path.join(os.homedir(), '.name-maker', 'sessions');

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  input: UserInput;
  generatedNames: string[];
  results: NameCheckResult[];
}

function ensureSessionsDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function getSessionPath(id: string): string {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

export function generateSessionId(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}-${random}`;
}

export function createSession(input: UserInput): Session {
  ensureSessionsDir();

  const id = generateSessionId();
  const now = new Date().toISOString();

  // Generate a friendly name from the product description
  const name = input.description.slice(0, 40) + (input.description.length > 40 ? '...' : '');

  const session: Session = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    input,
    generatedNames: [],
    results: []
  };

  saveSession(session);
  return session;
}

export function saveSession(session: Session): void {
  ensureSessionsDir();
  session.updatedAt = new Date().toISOString();
  const filePath = getSessionPath(session.id);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
}

export function loadSession(id: string): Session | null {
  const filePath = getSessionPath(id);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as Session;
    }
  } catch {
    // Session file corrupted or invalid
  }
  return null;
}

export function listSessions(): Session[] {
  ensureSessionsDir();

  try {
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first

    const sessions: Session[] = [];
    for (const file of files.slice(0, 10)) { // Limit to 10 most recent
      const filePath = path.join(SESSIONS_DIR, file);
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        sessions.push(JSON.parse(data) as Session);
      } catch {
        // Skip corrupted files
      }
    }
    return sessions;
  } catch {
    return [];
  }
}

export function deleteSession(id: string): boolean {
  const filePath = getSessionPath(id);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch {
    // Failed to delete
  }
  return false;
}

export function formatSessionDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
