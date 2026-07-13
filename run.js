require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { fetchBatch } = require('./fetch-batch');
const { generateDigest } = require('./summarize');
const { generateAudio } = require('./audio');
const { getClippersUpdate } = require('./clippers');
const { renderEmailHtml, renderWebPage } = require('./template');
const { archiveMessages } = require('./archive');

const PAGES_URL = 'https://khorizon123.github.io/morning-brief';
const AUDIO_PATH = 'audio/latest.mp3';
const PLAYER_PATH = 'audio/player.html';

const isLive = process.argv.includes('--live');
const TARGET_HOUR = 7;
// On 2026-07-10 GitHub dropped both then-existing 7am triggers; even after
// bumping to 4 triggers/hour, on 2026-07-13 it dropped all four -- the whole
// 7am hour never fired. A single-hour match is too fragile against GitHub
// silently dropping a whole hour's scheduled runs, so this accepts any hour
// adjacent to the target too. The workflow already polls every 15 minutes
// around the clock, so this just gives neighboring hours' triggers a chance
// to catch a fully-dropped target hour. alreadySentToday() still guards
// against sending more than once within the widened window.
function isWithinTargetWindow(timezone) {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  const hour = parseInt(hourStr, 10) % 24;
  const diff = Math.min((hour - TARGET_HOUR + 24) % 24, (TARGET_HOUR - hour + 24) % 24);
  return diff <= 1;
}

// The workflow now checks twice an hour for redundancy (see daily-brief.yml),
// so both checks could land inside the target hour. Guard against sending
// twice by checking whether today's audio commit has already happened.
function alreadySentToday(timezone) {
  try {
    const lastCommitIso = execSync(`git log -1 --format=%cI -- ${AUDIO_PATH}`).toString().trim();
    if (!lastCommitIso) return false;
    const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return dateFmt.format(new Date(lastCommitIso)) === dateFmt.format(new Date());
  } catch {
    return false;
  }
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function sendEmail(html, date) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: process.env.RESEND_TO_EMAIL,
      subject: `Morning Brief — ${date}`,
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend error: ${data.message || JSON.stringify(data)}`);
  return data;
}

const MAX_REASONABLE_AUDIO_BYTES = 40 * 1024 * 1024; // ~40MB is generous for a 15-min voice MP3

function pushAudio(buffer, date, digest, clippers) {
  if (buffer.length > MAX_REASONABLE_AUDIO_BYTES) {
    throw new Error(
      `Audio buffer is ${(buffer.length / 1024 / 1024).toFixed(1)}MB, far beyond what a 10-15 minute ` +
      `digest should produce. Aborting before writing/committing -- this usually means a digest field ` +
      `was mis-shaped and got read character-by-character. Not pushing.`
    );
  }
  fs.mkdirSync(path.dirname(AUDIO_PATH), { recursive: true });
  fs.writeFileSync(AUDIO_PATH, buffer);

  const webPageHtml = renderWebPage({ date, digest, audioFileName: path.basename(AUDIO_PATH), clippers });
  fs.writeFileSync(PLAYER_PATH, webPageHtml, 'utf8');

  execSync(`git add ${AUDIO_PATH} ${PLAYER_PATH}`);
  try {
    execSync(`git commit -m "Update daily audio ${new Date().toISOString().slice(0, 10)}"`);
    execSync('git push');
  } catch (err) {
    console.log('Nothing to commit or push failed:', err.message.split('\n')[0]);
  }
  return `${PAGES_URL}/${PLAYER_PATH}`;
}

async function main() {
  console.log(`Mode: ${isLive ? 'LIVE (will send email + archive Gmail)' : 'DRY RUN (no send, no archive)'}`);

  if (process.env.SCHEDULED_RUN === 'true') {
    const timezone = process.env.TARGET_TIMEZONE || 'America/Chicago';
    if (!isWithinTargetWindow(timezone)) {
      console.log(`Not within the 7am window in ${timezone} -- skipping this check.`);
      return;
    }
    if (alreadySentToday(timezone)) {
      console.log(`Already sent today's brief in ${timezone} -- skipping duplicate.`);
      return;
    }
    console.log(`Within the 7am window in ${timezone} -- proceeding with today's brief.`);
  }

  const date = formatDate(new Date());

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
  const audioUrl = pushAudio(audioBuffer, date, digest, clippers);
  console.log('Audio player URL:', audioUrl);

  const html = renderEmailHtml({
    date,
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
  const sendResult = await sendEmail(html, date);
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
