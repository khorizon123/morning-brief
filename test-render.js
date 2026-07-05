const fs = require('fs');
const { fetchBatch } = require('./fetch-batch');
const { generateDigest } = require('./summarize');
const { renderEmailHtml } = require('./template');

const CACHE_PATH = './digest-cache.json';

async function getDigest() {
  if (fs.existsSync(CACHE_PATH)) {
    console.log('Using cached digest (delete digest-cache.json to force regeneration).');
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  }
  console.log('No cache found. Fetching + summarizing (calls Claude)...');
  const batch = await fetchBatch('2d');
  const digest = await generateDigest(batch);
  fs.writeFileSync(CACHE_PATH, JSON.stringify(digest, null, 2), 'utf8');
  return digest;
}

async function main() {
  const digest = await getDigest();

  const html = renderEmailHtml({
    date: 'Sunday, July 5, 2026',
    digest,
    audioUrl: '#',
    clippers: {
      result: 'W',
      opponent: 'Lakers',
      score: '112-104',
      streak: '3-game win streak',
      standing: '4th in West',
    },
  });

  fs.writeFileSync('preview.html', html, 'utf8');
  console.log('Wrote preview.html');
}

main().catch(err => console.error('Error:', err.message));
