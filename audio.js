require('dotenv').config();

const API_KEY = process.env.GOOGLE_TTS_API_KEY;
const TTS_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;
const VOICE = 'en-US-Neural2-J';
const MAX_CHUNK_CHARS = 3500; // safely under the 5000-byte API limit even with multi-byte punctuation

function escapeSsml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// A non-empty string is truthy, so `x || []` doesn't guard against a
// mis-shaped string field -- and strings are iterable char-by-char in JS,
// which silently produces garbage instead of an error. Guard explicitly.
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// Each block gets read aloud, then a pause. Section-header blocks get a longer
// pause after them so transitions feel deliberate rather than rushed.
function buildBlocks(digest, clippers) {
  const blocks = [];
  const say = (text, pause = 500) => blocks.push({ text, pause });
  const sectionHeader = (text) => blocks.push({ text, pause: 900 });

  say("Good morning. Here's your Morning Brief.", 700);
  if (clippers) {
    const resultWord = clippers.result === 'W' ? 'beat' : 'lost to';
    say(`The Clippers ${resultWord} the ${clippers.opponent}, ${clippers.score}.`, 800);
  }

  sectionHeader("Let's start with the world.");
  for (const item of asArray(digest.world)) {
    say(`${item.headline}. ${item.narrative} ${item.context}`);
  }

  sectionHeader('Now, markets and deals.');
  for (const item of asArray(digest.marketsAndDeals)) {
    say(`${item.headline}. ${item.body}`);
  }

  sectionHeader('Next, A-I and tech.');
  for (const item of asArray(digest.aiAndTech)) {
    say(`${item.headline}. ${item.body}`);
  }

  sectionHeader('A few other interesting items.');
  for (const item of asArray(digest.interesting)) {
    say(item.headline, 400);
  }

  if (digest.company) {
    sectionHeader(`Today's company is ${digest.company.name}.`);
    say(digest.company.body);
  }

  sectionHeader("Finally, here's what's on the radar this week.");
  for (const item of asArray(digest.upcoming)) {
    say(`${item.headline}. ${item.body}`);
  }

  say("That's your Morning Brief. Have a great day.");

  return blocks;
}

// Packs blocks into <speak> chunks that stay under the API's per-request size limit,
// only ever breaking between blocks (never mid-sentence).
function packIntoSsmlChunks(blocks) {
  const chunks = [];
  let current = '';

  for (const block of blocks) {
    const piece = `${escapeSsml(block.text)}<break time="${block.pause}ms"/>`;
    if (current.length + piece.length > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = '';
    }
    current += piece;
  }
  if (current) chunks.push(current);

  return chunks.map(c => `<speak>${c}</speak>`);
}

async function synthesizeChunk(ssml) {
  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { ssml },
      voice: { languageCode: 'en-US', name: VOICE },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`TTS error: ${data.error.message}`);
  return Buffer.from(data.audioContent, 'base64');
}

async function generateAudio(digest, clippers) {
  const blocks = buildBlocks(digest, clippers);
  const chunks = packIntoSsmlChunks(blocks);

  const buffers = [];
  for (const chunk of chunks) {
    buffers.push(await synthesizeChunk(chunk));
  }

  return Buffer.concat(buffers);
}

module.exports = { generateAudio, buildBlocks, packIntoSsmlChunks };
