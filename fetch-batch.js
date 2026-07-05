const { extractEmail } = require('./extract');
const { classify } = require('./sources');
const { gmail } = require('./gmail-client');

// Fetches and classifies all newsletter emails newer than `window` (Gmail search syntax, e.g. '1d').
async function fetchBatch(window = '1d') {
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 100,
    q: `newer_than:${window}`,
  });

  const messages = listRes.data.messages || [];
  const batch = [];

  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const extracted = extractEmail(full.data);
    const source = classify({
      senderName: extracted.senderName,
      senderEmail: extracted.senderEmail,
      subject: extracted.subject,
    });

    batch.push({
      id: msg.id,
      tier: source.tier,
      sourceName: source.name,
      subject: extracted.subject,
      date: extracted.date,
      text: extracted.text,
      links: extracted.links,
    });
  }

  return batch;
}

module.exports = { fetchBatch };
