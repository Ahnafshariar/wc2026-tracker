'use strict';
/**
 * football-data.org v4 provider (RECOMMENDED for completeness).
 * One request returns EVERY World Cup match with explicit stage, group,
 * score and status — far more reliable than scraping day-by-day.
 *
 *   DATA_SOURCE=footballdata   FOOTBALL_API_KEY=<free key>
 *
 * Returns { records, errors }.
 */
const BASE = 'https://api.football-data.org/v4';

async function fetchResults() {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) return { records: [], errors: ['FOOTBALL_API_KEY not set'] };
  try {
    const res = await fetch(`${BASE}/competitions/WC/matches`, { headers: { 'X-Auth-Token': key } });
    if (!res.ok) return { records: [], errors: [`football-data HTTP ${res.status}`] };
    const data = await res.json();
    const records = (data.matches || []).map((m) => ({
      stage: m.stage,
      group: m.group,
      homeName: m.homeTeam && m.homeTeam.name,
      awayName: m.awayTeam && m.awayTeam.name,
      homeGoals: m.score && m.score.fullTime ? m.score.fullTime.home : null,
      awayGoals: m.score && m.score.fullTime ? m.score.fullTime.away : null,
      status: m.status,
      winnerName: winnerName(m),
      utcDate: m.utcDate
    }));
    return { records, errors: [] };
  } catch (e) {
    return { records: [], errors: [e.message] };
  }
}

function winnerName(m) {
  const w = m.score && m.score.winner;
  if (w === 'HOME_TEAM') return m.homeTeam.name;
  if (w === 'AWAY_TEAM') return m.awayTeam.name;
  return null;
}

module.exports = { fetchResults };
