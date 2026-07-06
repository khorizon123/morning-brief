const fs = require('fs');
const { execFileSync } = require('child_process');

const content = fs.readFileSync('.env', 'utf8');
const lines = content.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'));

for (const line of lines) {
  const idx = line.indexOf('=');
  const key = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim();
  if (!key || !value) continue;

  execFileSync('gh', ['secret', 'set', key, '--body', value], { stdio: 'inherit' });
  console.log(`Set secret: ${key}`);
}
