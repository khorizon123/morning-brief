const fs = require('fs');
const { generateAudio, buildBlocks } = require('./audio');

const CACHE_PATH = './digest-cache.json';

async function main() {
  if (!fs.existsSync(CACHE_PATH)) {
    console.error('No digest-cache.json found. Run test-render.js first to generate one.');
    return;
  }
  const digest = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));

  const clippers = {
    result: 'W',
    opponent: 'Lakers',
    score: '112 to 104',
  };

  const blocks = buildBlocks(digest, clippers);
  const wordCount = blocks.reduce((sum, b) => sum + b.text.split(/\s+/).length, 0);
  const estimatedMinutes = (wordCount / 155).toFixed(1); // ~155 wpm for Neural voices at 1.0x
  console.log(`${blocks.length} blocks, ~${wordCount} words, estimated ~${estimatedMinutes} minutes of audio.`);

  console.log('Synthesizing (multiple TTS calls, may take a bit)...');
  const audioBuffer = await generateAudio(digest, clippers);
  fs.writeFileSync('preview-audio.mp3', audioBuffer);
  console.log(`Wrote preview-audio.mp3 (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(err => console.error('Error:', err.message));
