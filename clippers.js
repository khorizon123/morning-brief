const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
const STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';

function toEspnDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

async function findClippersGame(dateStr) {
  const res = await fetch(`${SCOREBOARD_URL}?dates=${dateStr}`);
  const data = await res.json();
  const event = (data.events || []).find(e =>
    e.competitions[0].competitors.some(c => c.team.abbreviation === 'LAC')
  );
  if (!event) return null;
  if (!event.status?.type?.completed) return null;

  const competitors = event.competitions[0].competitors;
  const clippers = competitors.find(c => c.team.abbreviation === 'LAC');
  const opponent = competitors.find(c => c.team.abbreviation !== 'LAC');

  return {
    result: clippers.winner ? 'W' : 'L',
    opponent: opponent.team.displayName,
    score: `${clippers.score}-${opponent.score}`,
  };
}

async function getClippersStanding() {
  const res = await fetch(STANDINGS_URL);
  const data = await res.json();

  for (const conference of data.children || []) {
    const entries = conference.standings?.entries || [];
    const index = entries.findIndex(e => e.team.abbreviation === 'LAC');
    if (index === -1) continue;

    const streakStat = entries[index].stats.find(s => s.type === 'streak');
    return {
      standing: `${index + 1}${ordinalSuffix(index + 1)} in ${conference.abbreviation}`,
      streak: streakStat ? formatStreak(streakStat.displayValue) : null,
    };
  }
  return { standing: null, streak: null };
}

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatStreak(displayValue) {
  // e.g. "W1" -> "1-game win streak", "L3" -> "3-game losing streak"
  const match = displayValue.match(/^([WL])(\d+)$/);
  if (!match) return null;
  const [, letter, count] = match;
  const word = letter === 'W' ? 'win' : 'losing';
  return `${count}-game ${word} streak`;
}

// Checks the last 2 calendar days (UTC) for a completed Clippers game.
async function getClippersUpdate() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const date of [yesterday, today]) {
    const game = await findClippersGame(toEspnDate(date));
    if (game) {
      const { standing, streak } = await getClippersStanding();
      return { ...game, standing, streak };
    }
  }
  return null;
}

module.exports = { getClippersUpdate, findClippersGame, getClippersStanding };
