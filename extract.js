// Extracts a clean, readable {senderName, senderEmail, subject, date, text, links}
// from a raw Gmail API message (format: 'full').

function collectParts(payload, collected = { text: [], html: [] }) {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    collected.text.push(Buffer.from(payload.body.data, 'base64').toString('utf8'));
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    collected.html.push(Buffer.from(payload.body.data, 'base64').toString('utf8'));
  }
  if (payload.parts) {
    for (const part of payload.parts) collectParts(part, collected);
  }
  return collected;
}

function htmlToText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function findEmbeddedSender(text) {
  const match = text.match(/From:\s*(.+?)\s*<([^>]+)>[\s\S]{0,300}?Subject:[^\n]*\n/);
  if (!match) return null;
  return { name: match[1].trim(), email: match[2].trim(), headerBlockEnd: match.index + match[0].length };
}

const BOILERPLATE_LABEL = /unsubscribe|privacy|advertise|manage.*preferences|update.*preferences|sign up|view in browser|terms of service|contact us|help center|download the app/i;

// Pulls (label, url) pairs out of the raw body before tracking-link text is stripped,
// so downstream code still has something to link to even though the display text gets cleaned.
function extractLinks(rawText) {
  const links = [];
  const seenUrls = new Set();

  function addLink(label, url) {
    label = label.replace(/\s+/g, ' ').trim();
    const cleanUrl = url.trim();
    if (!label || seenUrls.has(cleanUrl) || BOILERPLATE_LABEL.test(label)) return;
    seenUrls.add(cleanUrl);
    links.push({ label, url: cleanUrl });
  }

  let m;

  // Outlook/NYT plain-text style: "label text<https://...>"
  const anglePattern = /([^\n<]{3,140})<(https?:\/\/[^>]+)>/g;
  while ((m = anglePattern.exec(rawText))) addLink(m[1], m[2]);

  // Markdown style: "[label](https://...)"
  const mdPattern = /\[([^\]]{3,140})\]\((https?:\/\/[^)]+)\)/g;
  while ((m = mdPattern.exec(rawText))) addLink(m[1], m[2]);

  // Reference-footnote style (TLDR/Rundown): "[4] https://..." near the bottom,
  // referenced inline elsewhere as "...headline text [4]".
  const footnotes = {};
  const footnotePattern = /^\s*\[(\d+)]\s+(https?:\/\/\S+)/gm;
  while ((m = footnotePattern.exec(rawText))) footnotes[m[1]] = m[2];
  if (Object.keys(footnotes).length) {
    const inlinePattern = /([^\n[]{3,140})\[(\d+)]/g;
    while ((m = inlinePattern.exec(rawText))) {
      const url = footnotes[m[2]];
      if (url) addLink(m[1], url);
    }
  }

  return links;
}

// zero-width space/joiners, BOM, non-breaking space -- used by newsletters
// to pad hidden preview text.
const INVISIBLE_CHARS = /[\u200B\u200C\u200D\uFEFF\u00A0]/g;

function cleanText(rawText) {
  return rawText
    .replace(INVISIBLE_CHARS, ' ')
    .replace(/<https?:\/\/[^>]+>/g, '') // Outlook-style bracketed tracking links
    .replace(/\[https?:\/\/[^\]]+\]/g, '') // markdown-style bracketed raw links
    .replace(/\(https?:\/\/[^)]{40,}\)/g, '') // long tracking URLs inside parens
    .replace(/^_{5,}$/gm, '') // Outlook forward separator lines
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractEmail(message) {
  const headers = message.payload.headers;
  const gmailFrom = headers.find(h => h.name === 'From')?.value || '';
  const rawSubject = headers.find(h => h.name === 'Subject')?.value || '';
  const date = headers.find(h => h.name === 'Date')?.value || '';
  const subject = rawSubject.replace(/^(FW:|Fwd:|Fw:)\s*/i, '').trim();

  const { text, html } = collectParts(message.payload);
  let body = text.length ? text.join('\n') : htmlToText(html.join('\n'));

  const embedded = findEmbeddedSender(body);

  let senderName, senderEmail;
  if (embedded) {
    senderName = embedded.name;
    senderEmail = embedded.email;
    body = body.slice(embedded.headerBlockEnd);
  } else {
    senderName = gmailFrom.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim() || gmailFrom;
    senderEmail = gmailFrom.match(/<([^>]+)>/)?.[1] || gmailFrom;
  }

  const links = extractLinks(body);

  return {
    senderName,
    senderEmail,
    subject,
    date,
    text: cleanText(body),
    links,
  };
}

module.exports = { extractEmail };
