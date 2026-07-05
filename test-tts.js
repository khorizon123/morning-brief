require('dotenv').config();
const fs = require('fs');

const API_KEY = process.env.GOOGLE_TTS_API_KEY;
const URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;

async function main() {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: 'Good morning. This is a test of the Morning Brief text to speech setup.' },
      voice: { languageCode: 'en-US', name: 'en-US-Neural2-J' },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });

  const data = await res.json();

  if (data.error) {
    console.error('Error:', data.error.message);
    return;
  }

  const audioBuffer = Buffer.from(data.audioContent, 'base64');
  fs.writeFileSync('test-output.mp3', audioBuffer);
  console.log('Success. Saved test-output.mp3 — play it to confirm audio works.');
}

main();
