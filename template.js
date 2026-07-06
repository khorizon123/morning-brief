// Renders the Morning Brief digest into a single self-contained HTML email.

const COLORS = {
  headerFrom: '#1a3a5c',
  headerTo: '#0d2137',
  accentBar: '#2a5a8c',
  amber: '#BA7517',
  link: '#1d5a8c',
  bodyText: '#1f1f1f',
  contextText: '#555555',
  muted: '#9fb8d1',
};

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "Arial, Helvetica, sans-serif";

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/\n/g, '');
}

// A non-empty string is truthy, so `x || []` doesn't guard against a
// mis-shaped string field. Guard explicitly rather than relying on that.
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readMoreLink(link, sourceName) {
  if (!link) {
    return `<span style="font-family:${SANS};font-size:13px;color:#888;">${escapeHtml(sourceName)}</span>`;
  }
  return `<a href="${escapeAttr(link)}" style="color:${COLORS.link};font-family:${SANS};font-size:13px;text-decoration:none;">&rarr; Read more (${escapeHtml(sourceName)})</a>`;
}

function sectionHeader(title) {
  return `<h2 style="color:${COLORS.amber};font-family:${SANS};font-size:13px;letter-spacing:1.5px;text-transform:uppercase;border-bottom:2px solid ${COLORS.amber};padding-bottom:8px;margin:32px 0 18px 0;">${escapeHtml(title)}</h2>`;
}

function renderWorldItem(item) {
  return `
  <div style="margin-bottom:24px;">
    <h3 class="mb-story-title" style="font-family:${SERIF};font-size:19px;line-height:1.3;margin:0 0 8px 0;color:${COLORS.bodyText};">${escapeHtml(item.headline)}</h3>
    <p class="mb-story-text" style="font-family:${SERIF};font-size:15.5px;line-height:1.55;color:${COLORS.bodyText};margin:0 0 8px 0;">${escapeHtml(item.narrative)}</p>
    <p class="mb-story-text" style="font-family:${SERIF};font-size:15.5px;line-height:1.55;color:${COLORS.contextText};font-style:italic;margin:0 0 10px 0;">${escapeHtml(item.context)}</p>
    ${readMoreLink(item.link, item.sourceName)}
  </div>`;
}

function renderBodyItem(item) {
  return `
  <div style="margin-bottom:24px;">
    <h3 class="mb-story-title" style="font-family:${SERIF};font-size:19px;line-height:1.3;margin:0 0 8px 0;color:${COLORS.bodyText};">${escapeHtml(item.headline)}</h3>
    <p class="mb-story-text" style="font-family:${SERIF};font-size:15.5px;line-height:1.55;color:${COLORS.bodyText};margin:0 0 10px 0;">${escapeHtml(item.body)}</p>
    ${readMoreLink(item.link, item.sourceName)}
  </div>`;
}

function renderInterestingItem(item) {
  const inner = escapeHtml(item.headline);
  const content = item.link
    ? `<a href="${escapeAttr(item.link)}" style="color:${COLORS.link};text-decoration:underline;">${inner}</a>`
    : inner;
  return `<li style="font-family:${SERIF};font-size:15.5px;line-height:1.6;color:${COLORS.bodyText};margin-bottom:10px;">${content}</li>`;
}

function renderUpcomingItem(item) {
  return `
  <div style="margin-bottom:16px;">
    <h3 style="font-family:${SERIF};font-size:16.5px;line-height:1.3;margin:0 0 4px 0;color:${COLORS.bodyText};">${escapeHtml(item.headline)}</h3>
    <p style="font-family:${SERIF};font-size:15px;line-height:1.5;color:${COLORS.contextText};margin:0;">${escapeHtml(item.body)}</p>
  </div>`;
}

function renderClippersLine(clippers) {
  if (!clippers) return '';
  const resultWord = clippers.result === 'W' ? 'beat' : 'lost to';
  return `
        <tr>
          <td style="padding-top:14px;font-family:${SANS};font-size:13.5px;color:${COLORS.muted};">
            Clippers ${resultWord} ${escapeHtml(clippers.opponent)} ${escapeHtml(clippers.score)}
            ${clippers.streak ? ` &middot; ${escapeHtml(clippers.streak)}` : ''}
            ${clippers.standing ? ` &middot; ${escapeHtml(clippers.standing)}` : ''}
          </td>
        </tr>`;
}

// Shared between the email and the hosted web page -- both show the same
// six sections, just with a different header/audio treatment around them.
function renderBodyContent(digest) {
  const world = asArray(digest.world).map(renderWorldItem).join('');
  const marketsAndDeals = asArray(digest.marketsAndDeals).map(renderBodyItem).join('');
  const aiAndTech = asArray(digest.aiAndTech).map(renderBodyItem).join('');
  const interesting = asArray(digest.interesting).map(renderInterestingItem).join('');
  const upcoming = asArray(digest.upcoming).map(renderUpcomingItem).join('');

  const company = digest.company
    ? `
  <div>
    <h3 style="font-family:${SERIF};font-size:19px;line-height:1.3;margin:0 0 8px 0;color:${COLORS.bodyText};">${escapeHtml(digest.company.name)}</h3>
    <p style="font-family:${SERIF};font-size:15.5px;line-height:1.55;color:${COLORS.bodyText};margin:0;">${escapeHtml(digest.company.body)}</p>
  </div>`
    : '';

  return `
    ${sectionHeader('World')}
    ${world}

    ${sectionHeader('Markets & Deals')}
    ${marketsAndDeals}

    ${sectionHeader('AI & Tech')}
    ${aiAndTech}

    ${sectionHeader('Interesting')}
    <ul style="padding-left:20px;margin:0;">${interesting}</ul>

    ${sectionHeader('Company')}
    ${company}

    ${sectionHeader('Upcoming')}
    ${upcoming}`;
}

function renderEmailHtml({ date, digest, audioUrl, clippers }) {
  const bodyContent = renderBodyContent(digest);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Morning Brief — ${escapeHtml(date)}</title>
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body { margin: 0; padding: 0; background: #e9e9e9; }
  [data-ogsc] .mb-header, [data-ogsc] .mb-header * { background: ${COLORS.headerFrom} !important; color: #ffffff !important; }
  @media only screen and (max-width: 480px) {
    .mb-container { width: 100% !important; }
    .mb-header { padding: 20px 18px 18px 18px !important; }
    .mb-header-title { font-size: 25px !important; }
    .mb-body { padding: 6px 18px 20px 18px !important; }
    .mb-story-title { font-size: 17.5px !important; }
    .mb-story-text { font-size: 15px !important; }
  }
</style>
</head>
<body>
<div class="mb-container" style="max-width:640px;margin:0 auto;background:#ffffff;">
  <div style="height:3px;background:${COLORS.accentBar};"></div>
  <div class="mb-header" style="background:linear-gradient(135deg, ${COLORS.headerFrom}, ${COLORS.headerTo});padding:28px 28px 24px 28px;">
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="font-family:${SANS};font-size:12.5px;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(date)}</td>
      </tr>
      <tr>
        <td class="mb-header-title" style="padding-top:6px;font-family:${SERIF};font-size:30px;font-weight:bold;color:#ffffff;">Morning Brief</td>
      </tr>
      <tr>
        <td style="padding-top:16px;">
          <a href="${escapeAttr(audioUrl || '#')}" style="display:inline-block;background:#ffffff;color:${COLORS.headerFrom};text-decoration:none;padding:10px 20px;border-radius:24px;font-family:${SANS};font-size:14px;font-weight:bold;">&#9654; Listen to today's brief</a>
        </td>
      </tr>
      ${renderClippersLine(clippers)}
    </table>
  </div>

  <div class="mb-body" style="padding:8px 28px 28px 28px;">
    ${bodyContent}
  </div>
</div>
</body>
</html>`;
}

// The full digest as a standalone web page, with a real working <audio>
// player up top -- unlike the email, a normal webpage isn't sanitized by a
// mail client, so audio actually works here. This is what the email's
// "Listen" button links to: one page with both the player and the full
// newsletter content, rather than a bare audio-only stub.
function renderWebPage({ date, digest, audioFileName, clippers }) {
  const bodyContent = renderBodyContent(digest);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Morning Brief — ${escapeHtml(date)}</title>
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body { margin: 0; padding: 0; background: #e9e9e9; }
  [data-ogsc] .mb-header, [data-ogsc] .mb-header * { background: ${COLORS.headerFrom} !important; color: #ffffff !important; }
  audio { width: 100%; margin-top: 16px; }
  @media only screen and (max-width: 480px) {
    .mb-container { width: 100% !important; }
    .mb-header { padding: 20px 18px 18px 18px !important; }
    .mb-header-title { font-size: 25px !important; }
    .mb-body { padding: 6px 18px 20px 18px !important; }
    .mb-story-title { font-size: 17.5px !important; }
    .mb-story-text { font-size: 15px !important; }
  }
</style>
</head>
<body>
<div class="mb-container" style="max-width:640px;margin:0 auto;background:#ffffff;">
  <div style="height:3px;background:${COLORS.accentBar};"></div>
  <div class="mb-header" style="background:linear-gradient(135deg, ${COLORS.headerFrom}, ${COLORS.headerTo});padding:28px 28px 24px 28px;">
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="font-family:${SANS};font-size:12.5px;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(date)}</td>
      </tr>
      <tr>
        <td class="mb-header-title" style="padding-top:6px;font-family:${SERIF};font-size:30px;font-weight:bold;color:#ffffff;">Morning Brief</td>
      </tr>
      ${renderClippersLine(clippers)}
    </table>
    <audio controls autoplay src="${escapeAttr(audioFileName)}">
      Your browser doesn't support inline audio. <a href="${escapeAttr(audioFileName)}" style="color:#fff;">Download the MP3</a> instead.
    </audio>
  </div>

  <div class="mb-body" style="padding:8px 28px 28px 28px;">
    ${bodyContent}
  </div>
</div>
</body>
</html>`;
}

module.exports = { renderEmailHtml, renderWebPage };
