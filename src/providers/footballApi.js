'use strict';
/**
 * Live data adapter (extension point).
 *
 * The app ships with a self-contained simulator so it deploys with zero
 * external dependencies (ideal for CI/CD). To use REAL data instead, set:
 *
 *   DATA_SOURCE=live
 *   FOOTBALL_API_KEY=<your key from football-data.org>
 *
 * Then implement the mapping from the API response into the app's
 * { teams, groups, matches } shape and feed it into the store.
 *
 * Scraping Google or similar is intentionally NOT used: it violates terms
 * of service, is brittle, and breaks without warning. A proper sports API
 * is the correct, stable source.
 */

const API_BASE = 'https://api.football-data.org/v4';

async function fetchCompetitionMatches(competition = 'WC') {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) throw new Error('FOOTBALL_API_KEY not set — live data unavailable.');

  const res = await fetch(`${API_BASE}/competitions/${competition}/matches`, {
    headers: { 'X-Auth-Token': key }
  });
  if (!res.ok) throw new Error(`Live API error: ${res.status} ${res.statusText}`);
  return res.json();
  // TODO: map res.matches -> app schema (teams, groups, matches) and load into the store.
}

function mode() {
  return process.env.DATA_SOURCE === 'live' && process.env.FOOTBALL_API_KEY
    ? 'live'
    : 'simulated';
}

module.exports = { fetchCompetitionMatches, mode };
