require('dotenv').config();
const { google } = require('googleapis');
const { classify } = require('./sources');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

function extractPlainText(payload, collected = []) {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    collected.push(Buffer.from(payload.body.data, 'base64').toString('utf8'));
  }
  if (payload.parts) {
    for (const part of payload.parts) extractPlainText(part, collected);
  }
  return collected.join('\n');
}

function findEmbeddedSender(text) {
  const match = text.match(/From:\s*(.+?)\s*<([^>]+)>/);
  return match ? { name: match[1].trim(), email: match[2].trim() } : null;
}

async function main() {
  const res = await gmail.users.messages.list({ userId: 'me', maxResults: 60, q: 'newer_than:10d' });
  const messages = res.data.messages || [];

  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const headers = full.data.payload.headers;
    const gmailFrom = headers.find(h => h.name === 'From')?.value || '';
    const rawSubject = headers.find(h => h.name === 'Subject')?.value || '';
    const subject = rawSubject.replace(/^(FW:|Fwd:|Fw:)\s*/i, '');

    const plainText = extractPlainText(full.data.payload);
    const embedded = findEmbeddedSender(plainText);

    const senderName = embedded ? embedded.name : (gmailFrom.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim() || gmailFrom);
    const senderEmail = embedded ? embedded.email : (gmailFrom.match(/<([^>]+)>/)?.[1] || gmailFrom);

    const result = classify({ senderName, senderEmail, subject });

    if (result === null) {
      console.log(`SKIP    | ${senderName} | ${subject}`);
    } else {
      console.log(`T${result.tier} ${result.name.padEnd(28)} | ${subject}`);
    }
  }
}

main().catch(err => console.error('Error:', err.message));
