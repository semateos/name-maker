export type TrademarkStatus = 'AVAILABLE' | 'PENDING' | 'REGISTERED' | 'UNKNOWN';
export type AvailabilityStatus = 'available' | 'taken' | 'unknown';

export type ProductType = 'app' | 'saas' | 'website' | 'physical' | 'service' | 'other';
export type NameStyle = 'real-words' | 'invented' | 'compound' | 'abstract' | 'any';
export type NameLength = 'short' | 'medium' | 'long' | 'any';
export type ToneStyle = 'modern' | 'friendly' | 'professional' | 'playful' | 'luxurious' | 'bold';

export interface UserInput {
  // Core product info
  productType: ProductType;
  description: string;
  targetAudience: string;
  industry: string;

  // Name preferences
  toneStyle: ToneStyle;
  nameStyle: NameStyle;
  nameLength: NameLength;

  // Inclusions/exclusions
  keywords: string[];
  themes: string[];
  avoidWords: string[];
  competitors: string[];
}

export interface GeneratedName {
  name: string;
  reasoning?: string;
}

export interface TrademarkResult {
  status: TrademarkStatus;
  details?: string;
}

export interface AppStoreResult {
  status: AvailabilityStatus;
  existingApp?: string;
  storeUrl?: string;
}

export interface DomainResult {
  domain: string;
  available: boolean;
}

export interface NameCheckResult {
  name: string;
  trademark: TrademarkResult;
  iosAppStore: AppStoreResult;
  googlePlayStore: AppStoreResult;
  domains: DomainResult[];
}

export interface CheckProgress {
  current: number;
  total: number;
  currentName: string;
  currentCheck: string;
}
