import http from 'http';
import open from 'open';
import chalk from 'chalk';
import Anthropic from '@anthropic-ai/sdk';
import { getApiKey, saveApiKey } from './utils/config';

const ANTHROPIC_CONSOLE_URL = 'https://console.anthropic.com/settings/keys';

const HTML_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Name Maker - Authentication</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #1a1a2e;
      margin-bottom: 8px;
      font-size: 28px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 24px;
      font-size: 14px;
    }
    .steps {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .step {
      display: flex;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .step:last-child { margin-bottom: 0; }
    .step-num {
      background: #6366f1;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .step-text { color: #444; font-size: 14px; line-height: 1.5; }
    .step-text a { color: #6366f1; }
    input {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      font-family: monospace;
      margin-bottom: 16px;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #6366f1;
    }
    button {
      width: 100%;
      padding: 14px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #4f46e5; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .error {
      background: #fee2e2;
      color: #dc2626;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      display: none;
    }
    .success {
      text-align: center;
      padding: 40px 20px;
    }
    .success-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    .success h2 { color: #059669; margin-bottom: 8px; }
    .success p { color: #666; }
  </style>
</head>
<body>
  <div class="container" id="form-container">
    <h1>🏷️ Name Maker</h1>
    <p class="subtitle">Connect your Anthropic account to generate AI-powered names</p>

    <div class="steps">
      <div class="step">
        <span class="step-num">1</span>
        <span class="step-text">Go to <a href="${ANTHROPIC_CONSOLE_URL}" target="_blank">Anthropic Console</a> (opens in new tab)</span>
      </div>
      <div class="step">
        <span class="step-num">2</span>
        <span class="step-text">Create a new API key or copy an existing one</span>
      </div>
      <div class="step">
        <span class="step-num">3</span>
        <span class="step-text">Paste your API key below</span>
      </div>
    </div>

    <div class="error" id="error"></div>

    <form id="auth-form">
      <input type="password" id="api-key" placeholder="sk-ant-api03-..." autocomplete="off" required>
      <button type="submit" id="submit-btn">Connect Account</button>
    </form>
  </div>

  <div class="container success" id="success-container" style="display: none;">
    <div class="success-icon">✅</div>
    <h2>Connected!</h2>
    <p>You can close this window and return to your terminal.</p>
  </div>

  <script>
    const form = document.getElementById('auth-form');
    const input = document.getElementById('api-key');
    const error = document.getElementById('error');
    const submitBtn = document.getElementById('submit-btn');
    const formContainer = document.getElementById('form-container');
    const successContainer = document.getElementById('success-container');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const apiKey = input.value.trim();

      if (!apiKey.startsWith('sk-ant-')) {
        error.textContent = 'Invalid API key format. It should start with sk-ant-';
        error.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Validating...';
      error.style.display = 'none';

      try {
        const res = await fetch('/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey })
        });

        const data = await res.json();

        if (data.success) {
          formContainer.style.display = 'none';
          successContainer.style.display = 'block';
        } else {
          error.textContent = data.error || 'Authentication failed. Please check your API key.';
          error.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Connect Account';
        }
      } catch (err) {
        error.textContent = 'Connection error. Please try again.';
        error.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Connect Account';
      }
    });
  </script>
</body>
</html>
`;

async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }]
    });
    return true;
  } catch {
    return false;
  }
}

function startAuthServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const server = http.createServer(async (req, res) => {
      // Serve the HTML page
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(HTML_PAGE);
        return;
      }

      // Handle API key submission
      if (req.method === 'POST' && req.url === '/auth') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { apiKey } = JSON.parse(body);

            // Validate the key
            const isValid = await validateApiKey(apiKey);

            if (isValid) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));

              // Save and resolve
              saveApiKey(apiKey);
              resolved = true;

              // Close server after a short delay
              setTimeout(() => {
                server.close();
                resolve(apiKey);
              }, 1000);
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Invalid API key. Please check and try again.' }));
            }
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
          }
        });
        return;
      }

      // 404 for other routes
      res.writeHead(404);
      res.end();
    });

    // Find an available port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        const url = `http://127.0.0.1:${port}`;

        console.log(chalk.cyan(`\n🌐 Opening browser for authentication...`));
        console.log(chalk.gray(`   If browser doesn't open, visit: ${url}\n`));

        // Open browser
        open(url).catch(() => {
          console.log(chalk.yellow(`   Could not open browser automatically.`));
          console.log(chalk.yellow(`   Please open this URL manually: ${url}\n`));
        });

        // Also open Anthropic console in another tab
        setTimeout(() => {
          open(ANTHROPIC_CONSOLE_URL).catch(() => {});
        }, 500);
      }
    });

    server.on('error', (err) => {
      if (!resolved) {
        reject(err);
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!resolved) {
        server.close();
        reject(new Error('Authentication timeout'));
      }
    }, 5 * 60 * 1000);
  });
}

export async function authenticateWithBrowser(): Promise<string | null> {
  try {
    const apiKey = await startAuthServer();
    console.log(chalk.green('✓ API key saved to ~/.name-maker/config.json\n'));
    return apiKey;
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.red(`\n❌ Authentication failed: ${error.message}\n`));
    }
    return null;
  }
}

export async function ensureAuthenticated(): Promise<string | null> {
  // Check if key already exists
  const existingKey = getApiKey();

  if (existingKey) {
    const source = process.env.ANTHROPIC_API_KEY ? 'environment' : 'saved config';
    console.log(chalk.green(`✓ Anthropic API key found in ${source}\n`));
    return existingKey;
  }

  // No key found - use browser auth
  console.log(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.cyan('  Welcome to Name Maker! 🏷️'));
  console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.white('  Name Maker uses Claude AI to generate creative product names'));
  console.log(chalk.white('  and checks their availability across trademarks, app stores,'));
  console.log(chalk.white('  and domains.\n'));

  return await authenticateWithBrowser();
}
