// Rolling record of recent digest items, used so the summarizer can tell
// apart genuinely new stories from ones it already covered -- without this,
// each day's digest is generated from that day's raw newsletters alone with
// no memory of what was reported before.
const fs = require('fs');

const HISTORY_PATH = 'digest-history.json';
const HISTORY_DAYS = 7;

// A non-empty string is truthy, so `x || []` doesn't guard against a
// mis-shaped string field. Guard explicitly rather than relying on that.
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function loadHistory() {
  try {
    const parsed = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
}

const gistOf = (text, max = 200) => String(text || '').slice(0, max);

function extractDayItems(digest) {
  const items = [];
  for (const item of asArray(digest.world)) {
    items.push({ section: 'World', headline: item.headline, gist: gistOf(item.narrative) });
  }
  for (const item of asArray(digest.marketsAndDeals)) {
    items.push({ section: 'Markets & Deals', headline: item.headline, gist: gistOf(item.body) });
  }
  for (const item of asArray(digest.aiAndTech)) {
    items.push({ section: 'AI & Tech', headline: item.headline, gist: gistOf(item.body) });
  }
  for (const item of asArray(digest.interesting)) {
    items.push({ section: 'Interesting', headline: item.headline, gist: '' });
  }
  return items;
}

// dateIso: 'YYYY-MM-DD' for today's run, used both to record and to prune.
function appendToHistory(history, dateIso, digest) {
  const cutoff = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const pruned = history.filter(day => new Date(day.date).getTime() >= cutoff);
  pruned.push({ date: dateIso, items: extractDayItems(digest) });
  return pruned;
}

function buildHistoryContext(history) {
  if (history.length === 0) return '';
  const days = history
    .map(day => {
      const lines = day.items
        .map(item => `  - [${item.section}] ${item.headline}${item.gist ? ` — ${item.gist}` : ''}`)
        .join('\n');
      return `${day.date}:\n${lines}`;
    })
    .join('\n\n');
  return (
    `PREVIOUSLY COVERED (last ${HISTORY_DAYS} days, for reference only -- do not repeat these stories' ` +
    `content, use this only to classify each new item's novelty below):\n\n${days}`
  );
}

module.exports = { loadHistory, saveHistory, appendToHistory, buildHistoryContext, HISTORY_PATH };
