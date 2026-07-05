require('dotenv').config();
const { google } = require('googleapis');
const { extractEmail } = require('./extract');
const { classify } = require('./sources');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

const SAMPLE_QUERIES = [
  'subject:"The Morning"',
  'subject:"World News"',
  'from:tldrnewsletter.com',
  'subject:"World in Brief"',
];

async function main() {
  for (const q of SAMPLE_QUERIES) {
    const res = await gmail.users.messages.list({ userId: 'me', maxResults: 1, q });
    const msg = res.data.messages?.[0];
    if (!msg) continue;

    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const extracted = extractEmail(full.data);
    const source = classify({
      senderName: extracted.senderName,
      senderEmail: extracted.senderEmail,
      subject: extracted.subject,
    });

    console.log('='.repeat(70));
    console.log(`QUERY: ${q}`);
    console.log(`SOURCE: T${source.tier} ${source.name}`);
    console.log(`SUBJECT: ${extracted.subject}`);
    console.log(`SENDER: ${extracted.senderName} <${extracted.senderEmail}>`);
    console.log(`TEXT LENGTH: ${extracted.text.length}`);
    console.log('--- FIRST 800 CHARS ---');
    console.log(extracted.text.slice(0, 800));
    console.log('');
  }
}

main().catch(err => console.error('Error:', err.message));
