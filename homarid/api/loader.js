const fs = require('fs');
const path = require('path');
const secretsPath = path.join(__dirname, '..', 'secrets.json');
if (fs.existsSync(secretsPath)) {
  const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  for (const [key, value] of Object.entries(secrets)) {
    process.env[key.toUpperCase()] = value;
  }
  console.log('[SECRETS] Loaded from secrets.json');
} else {
  console.log('[SECRETS] No secrets.json found  using existing environment');
}
require('./server');
