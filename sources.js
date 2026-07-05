// Classifies a newsletter email into { name, tier } based on subject pattern and sender.
// tier: 1 = anchor, 2 = fill-gap, 3 = weekly/feature.

const SOURCES = [
  // Tier 1 — anchors
  { name: 'FT Briefing', tier: 1, match: s => /^FT Briefing:/i.test(s.subject) },
  { name: 'FirstFT Americas', tier: 1, match: s => /^International morning headlines:/i.test(s.subject) },
  { name: 'WSJ AI & Business', tier: 1, match: s => /^WSJ AI & Business:/i.test(s.subject) },
  { name: 'NYT Morning', tier: 1, match: s => /^The Morning:/i.test(s.subject) },
  { name: 'Economist Daily Digest', tier: 1, match: s => s.senderName === 'The Economist Today' },
  { name: 'Rundown AI', tier: 1, match: s => s.senderEmail.includes('therundown.ai') },
  { name: 'TLDR AI', tier: 1, match: s => s.senderEmail.includes('tldrnewsletter.com') },

  // Tier 2 — fill gaps only
  { name: 'FT Due Diligence', tier: 2, match: s => /Due Diligence/i.test(s.subject) },
  { name: 'Dealbook', tier: 2, match: s => /^DealBook:/i.test(s.subject) },
  { name: 'WSJ Technology', tier: 2, match: s => s.senderName === 'WSJ Technology' },
  { name: 'FT Scoreboard', tier: 2, match: s => /^Scoreboard:/i.test(s.subject) },
  { name: 'NYT World', tier: 2, match: s => /^The World:/i.test(s.subject) && s.senderEmail.includes('nytimes.com') },
  { name: 'FT World Briefing', tier: 2, match: s => /^World News:/i.test(s.subject) },
  { name: 'FT Newswrap', tier: 2, match: s => /^Newswrap:/i.test(s.subject) },
  { name: 'FT Week Ahead', tier: 2, match: s => /^Week Ahead:/i.test(s.subject) },
  { name: "WSJ What's News", tier: 2, match: s => s.senderName === "WSJ What's News" },
  { name: 'WSJ Logistics Report', tier: 2, match: s => s.senderName === 'WSJ Logistics Report' },
  { name: 'Economist The Bottom Line', tier: 2, match: s => /^The Bottom Line:/i.test(s.subject) },
  { name: 'Economist Money Talks', tier: 2, match: s => /^Money Talks:/i.test(s.subject) },
  { name: 'Economist Business in Brief', tier: 2, match: s => /^Business in Brief:/i.test(s.subject) },

  // Tier 3 — weekly/feature, summarized once, never repeated
  { name: 'WSJ Future of Everything', tier: 3, match: s => /Future of Everything/i.test(s.subject) },
  { name: 'WSJ 8 Startup Failures', tier: 3, match: s => /Startup Failures/i.test(s.subject) },
  { name: 'NYT Good List', tier: 3, match: s => /Good List/i.test(s.subject) },
  { name: 'NYT Evening', tier: 3, match: s => /^The Evening:/i.test(s.subject) },
  { name: 'Economist World in Brief', tier: 3, match: s => /^The World in Brief:/i.test(s.subject) },
  { name: 'FT Due Diligence Weekly', tier: 3, match: s => /Due Diligence/i.test(s.subject) && /weekly/i.test(s.subject) },
  { name: "FT Editor's Choice", tier: 3, match: s => /^Editor.s Choice:/i.test(s.subject) },
];

function classify({ senderName, senderEmail, subject }) {
  const s = { senderName: senderName || '', senderEmail: (senderEmail || '').toLowerCase(), subject: subject || '' };

  for (const source of SOURCES) {
    if (source.match(s)) {
      return { name: source.name, tier: source.tier };
    }
  }

  // Unrecognized newsletter — don't silently drop it, treat as a Tier 2 fill-gap
  // source using its own subject line as the name.
  return { name: subject.slice(0, 60), tier: 2 };
}

module.exports = { classify };
