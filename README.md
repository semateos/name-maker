# Name Maker

An AI-powered CLI tool for generating product names and checking their availability across trademarks, app stores, and domains.

## Features

- **AI-Powered Name Generation** - Uses Claude AI to generate creative product name ideas based on your description, industry, target audience, and style preferences
- **Trademark Search** - Checks USPTO database for existing trademarks with links to search results
- **App Store Availability** - Checks both iOS App Store and Google Play Store for existing apps
- **Domain Availability** - Checks availability across popular TLDs (.com, .io, .ai, .app, .dev, and more)
- **Session Persistence** - Save and resume sessions to continue brainstorming later
- **Interactive Loop** - Chat-style interface for iterative name exploration

## Installation

```bash
git clone https://github.com/semateos/name-maker.git
cd name-maker
npm install
npm run build
```

## Setup

You'll need to authenticate with Anthropic to use Claude for name generation. The app supports three methods:

### Option 1: Browser Authentication (Recommended)

On first run, the app will prompt you to authenticate. Choose "Login with browser" to:
1. Open your browser to Anthropic's login page
2. Sign in with your Anthropic account
3. The app will automatically receive your credentials

This is the easiest method and doesn't require managing API keys.

### Option 2: API Key via Prompt

Choose "Enter API key manually" when prompted and paste your Anthropic API key. Get your key from: https://console.anthropic.com/settings/keys

### Option 3: Environment Variable

Set the `ANTHROPIC_API_KEY` environment variable before running:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Or create a `.env` file in the project root:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Your credentials are stored locally in `~/.name-maker/config.json` and never shared.

## Usage

```bash
npm start
```

Or after building:
```bash
node dist/index.js
```

### Interactive Flow

1. **Session Selection** - Start a new session or resume a previous one
2. **Product Details** - Describe your product, industry, and target audience
3. **Name Style** - Choose tone (modern, friendly, professional, etc.) and name type (real words, invented, compound, etc.)
4. **Creative Direction** - Add keywords, themes, and words to avoid
5. **Results** - View generated names with availability status across all platforms
6. **Iterate** - Generate more names, provide feedback, or check specific names

### Example Output

```
┌────────────────┬────────────┬─────────────┬─────────────┬────────────────────────────┐
│ Name           │ Trademark  │ iOS App     │ Google Play │ Domains                    │
├────────────────┼────────────┼─────────────┼─────────────┼────────────────────────────┤
│ Lumino         │ ⚠ PENDING  │ ✓ Available │ ✓ Available │ .com✗ .io✓ .ai✓ .app✓     │
│ Sparkline      │ ✓ AVAIL    │ ✓ Available │ ✓ Available │ .com✓ .io✓ .ai✓ .dev✓     │
│ NoteFlow       │ ✗ REG      │ ✗ Taken     │ ✓ Available │ .com✗ .io✗ .app✓          │
└────────────────┴────────────┴─────────────┴─────────────┴────────────────────────────┘
```

## Checked TLDs

The tool checks availability for these top-level domains:
- **Essential**: .com
- **Tech & Startups**: .io, .co, .ai, .app, .dev, .tech
- **Modern**: .so, .to, .gg, .xyz, .me
- **Industry**: .design, .digital, .cloud, .games

## How It Works

- **Trademark Search**: Uses headless browser automation to search the USPTO database
- **iOS App Store**: Queries the iTunes Search API
- **Google Play Store**: Searches via web scraping
- **Domain Availability**: Uses DNS resolution to check if domains are registered

## Notes

- Trademark results link directly to USPTO search for verification
- The trademark checker may occasionally be rate-limited by USPTO
- Domain availability via DNS is a quick check; always verify with a registrar before purchasing
- Sessions are stored in `~/.name-maker/sessions/`

## License

MIT
