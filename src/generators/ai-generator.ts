import Anthropic from '@anthropic-ai/sdk';
import { UserInput, GeneratedName } from '../types';

// Create client lazily to ensure API key is set
function getClient(): Anthropic {
  return new Anthropic();
}

const toneDescriptions: Record<string, string> = {
  modern: 'innovative, cutting-edge, sleek, minimalist, tech-forward',
  friendly: 'approachable, warm, welcoming, human, inviting',
  professional: 'trustworthy, established, serious, reliable, corporate',
  playful: 'fun, creative, energetic, quirky, memorable',
  luxurious: 'premium, exclusive, elegant, sophisticated, refined',
  bold: 'strong, confident, powerful, assertive, impactful'
};

const nameStyleDescriptions: Record<string, string> = {
  'real-words': 'actual dictionary words that relate to the product (like Slack, Apple, Square, Notion)',
  'invented': 'made-up but phonetically pleasing words that feel memorable (like Spotify, Kodak, Xerox, Hulu)',
  'compound': 'two words cleverly combined into one (like Facebook, YouTube, Snapchat, WordPress)',
  'abstract': 'evocative names that suggest rather than describe (like Amazon, Nike, Oracle, Uber)',
  'any': 'a creative mix of styles including real words, invented words, and compound words'
};

const lengthGuidelines: Record<string, string> = {
  short: '1-5 letters, ultra-punchy and easy to remember',
  medium: '6-8 letters, balanced length that works well for brands',
  long: '9+ letters, more descriptive but still memorable',
  any: 'whatever length works best for each name concept'
};

export async function generateNames(input: UserInput): Promise<GeneratedName[]> {
  const prompt = buildPrompt(input);
  return await callClaude(prompt);
}

export async function generateMoreNames(
  input: UserInput,
  previousNames: string[],
  feedback?: string
): Promise<GeneratedName[]> {
  const prompt = buildIterativePrompt(input, previousNames, feedback);
  return await callClaude(prompt);
}

async function callClaude(prompt: string): Promise<GeneratedName[]> {
  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      { role: 'user', content: prompt }
    ]
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  try {
    const names = JSON.parse(content.text) as GeneratedName[];
    return names;
  } catch {
    // Try to extract JSON from the response if it contains extra text
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as GeneratedName[];
    }
    throw new Error('Failed to parse name suggestions from Claude response');
  }
}

function buildPrompt(input: UserInput): string {
  const sections: string[] = [];

  // Introduction
  sections.push(`You are an expert brand naming consultant with 20 years of experience creating memorable product names. Generate 10 unique name ideas based on the following brief:`);

  // Product details
  sections.push(`
## Product Details
- **Type**: ${input.productType}
- **Description**: ${input.description}
- **Industry**: ${input.industry}
- **Target Audience**: ${input.targetAudience}`);

  // Name requirements
  sections.push(`
## Name Requirements
- **Tone**: ${toneDescriptions[input.toneStyle] || input.toneStyle}
- **Style**: ${nameStyleDescriptions[input.nameStyle] || input.nameStyle}
- **Length**: ${lengthGuidelines[input.nameLength] || 'any length'}`);

  // Keywords and themes
  if (input.keywords.length > 0 || input.themes.length > 0) {
    let creative = '\n## Creative Direction';
    if (input.keywords.length > 0) {
      creative += `\n- **Keywords to incorporate or draw from**: ${input.keywords.join(', ')}`;
    }
    if (input.themes.length > 0) {
      creative += `\n- **Themes/concepts to evoke**: ${input.themes.join(', ')}`;
    }
    sections.push(creative);
  }

  // Avoid list
  if (input.avoidWords.length > 0) {
    sections.push(`
## Words/Sounds to AVOID
${input.avoidWords.map(w => `- ${w}`).join('\n')}`);
  }

  // Competitors
  if (input.competitors.length > 0) {
    sections.push(`
## Competitor Names (differentiate from these)
${input.competitors.map(c => `- ${c}`).join('\n')}
Make sure the names are distinctly different from these competitors while still fitting the industry.`);
  }

  // Output requirements
  sections.push(`
## Requirements for Each Name
1. Must be easy to spell and pronounce
2. Should work well as a domain name (consider .com availability)
3. Should be legally defensible (avoid generic terms)
4. Must feel appropriate for the ${input.industry} industry
5. Should resonate with ${input.targetAudience}

## Output Format
Respond with a JSON array containing exactly 10 name objects. Each object should have:
- "name": The suggested name (1-2 words max)
- "reasoning": A brief explanation of why this name works (1 sentence)

Example format:
[
  {"name": "Lumina", "reasoning": "Evokes light and clarity, perfect for an innovative solution"},
  {"name": "SwiftHub", "reasoning": "Combines speed with connectivity, appealing to tech users"}
]

Return ONLY the JSON array, no other text or markdown formatting.`);

  return sections.join('\n');
}

function buildIterativePrompt(
  input: UserInput,
  previousNames: string[],
  feedback?: string
): string {
  const sections: string[] = [];

  // Introduction with context
  sections.push(`You are an expert brand naming consultant. We're continuing a naming session. Generate 10 NEW and DIFFERENT name ideas based on the brief below.`);

  // Product details (condensed)
  sections.push(`
## Product Brief
- **Type**: ${input.productType}
- **Description**: ${input.description}
- **Industry**: ${input.industry}
- **Target Audience**: ${input.targetAudience}
- **Tone**: ${toneDescriptions[input.toneStyle] || input.toneStyle}
- **Style**: ${nameStyleDescriptions[input.nameStyle] || input.nameStyle}
- **Length**: ${lengthGuidelines[input.nameLength] || 'any length'}`);

  // Previous names to avoid
  if (previousNames.length > 0) {
    sections.push(`
## Previously Suggested Names (DO NOT repeat these or similar variations)
${previousNames.map(n => `- ${n}`).join('\n')}`);
  }

  // User feedback for direction
  if (feedback) {
    sections.push(`
## User Feedback / Direction
The user has provided the following guidance for this round:
"${feedback}"

Please incorporate this feedback into your new suggestions. This is the most important consideration for this round.`);
  }

  // Keywords and themes
  if (input.keywords.length > 0 || input.themes.length > 0) {
    let creative = '\n## Creative Direction';
    if (input.keywords.length > 0) {
      creative += `\n- **Keywords**: ${input.keywords.join(', ')}`;
    }
    if (input.themes.length > 0) {
      creative += `\n- **Themes**: ${input.themes.join(', ')}`;
    }
    sections.push(creative);
  }

  // Avoid list
  if (input.avoidWords.length > 0) {
    sections.push(`
## Words/Sounds to AVOID
${input.avoidWords.map(w => `- ${w}`).join('\n')}`);
  }

  // Output requirements
  sections.push(`
## Output Format
Respond with a JSON array containing exactly 10 NEW name objects. Each must be:
- Completely different from all previous suggestions
- Easy to spell and pronounce
- Appropriate for the ${input.industry} industry

Format:
[
  {"name": "ExampleName", "reasoning": "Brief explanation"}
]

Return ONLY the JSON array, no other text.`);

  return sections.join('\n');
}
