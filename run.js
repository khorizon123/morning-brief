require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { fetchBatch } = require('./fetch-batch');
const { generateDigest } = require('./summarize');
const { generateAudio } = require('./audio');
const { getClippersUpdate } = require('./clippers');
const { renderEmailHtml } = require('./template');
const { archiveMessages } = require('./archive');

const REPO = 'khorizon123/morning-brief';
const BRANCH = 'master';
const AUDIO_PATH = 'audio/latest.mp3';

const isLive = process.argv.includes('--live');

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function sendEmail(html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: process.env.RESEND_TO_EMAIL,
      subject: `Morning Brief — ${formatDate(new Date())}`,
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend error: ${data.message || JSON.stringify(data)}`);
  return data;
}

const MAX_REASONABLE_AUDIO_BYTES = 40 * 1024 * 1024; // ~40MB is generous for a 15-min voice MP3

function pushAudio(buffer) {
  if (buffer.length > MAX_REASONABLE_AUDIO_BYTES) {
    throw new Error(
      `Audio buffer is ${(buffer.length / 1024 / 1024).toFixed(1)}MB, far beyond what a 10-15 minute ` +
      `digest should produce. Aborting before writing/committing -- this usually means a digest field ` +
      `was mis-shaped and got read character-by-character. Not pushing.`
    );
  }
  fs.mkdirSync(path.dirname(AUDIO_PATH), { recursive: true });
  fs.writeFileSync(AUDIO_PATH, buffer);
  execSync(`git add ${AUDIO_PATH}`);
  try {
    execSync(`git commit -m "Update daily audio ${new Date().toISOString().slice(0, 10)}"`);
    execSync('git push');
  } catch (err) {
    console.log('Nothing to commit or push failed:', err.message.split('\n')[0]);
  }
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${AUDIO_PATH}`;
}

async function main() {
  console.log(`Mode: ${isLive ? 'LIVE (will send email + archive Gmail)' : 'DRY RUN (no send, no archive)'}`);

  console.log('Fetching newsletters...');
  const batch = await fetchBatch('1d');
  console.log(`Fetched ${batch.length} emails.`);

  console.log('Checking Clippers...');
  const clippers = await getClippersUpdate();
  console.log(clippers ? `Clippers: ${clippers.result} vs ${clippers.opponent} ${clippers.score}` : 'No Clippers game.');

  console.log('Generating digest with Claude...');
  const digest = await generateDigest(batch);
  fs.writeFileSync('digest-debug.json', JSON.stringify(digest, null, 2), 'utf8');

  console.log('Generating audio...');
  const audioBuffer = await generateAudio(digest, clippers);

  console.log('Pushing audio to GitHub...');
  const audioUrl = pushAudio(audioBuffer);
  console.log('Audio URL:', audioUrl);

  const html = renderEmailHtml({
    date: formatDate(new Date()),
    digest,
    audioUrl,
    clippers,
  });

  fs.writeFileSync('last-run-preview.html', html, 'utf8');
  console.log('Wrote last-run-preview.html');

  if (!isLive) {
    console.log('\nDry run complete. Re-run with --live to actually send the email and archive Gmail messages.');
    return;
  }

  console.log('Sending email...');
  const sendResult = await sendEmail(html);
  console.log('Email sent:', sendResult.id);

  console.log('Archiving processed emails...');
  await archiveMessages(batch.map(b => b.id));
  console.log(`Archived ${batch.length} emails.`);

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
