'use strict';
/**
 * ESPN provider (keyless). Pulls the men's World Cup scoreboard day-by-day
 * across the tournament window and returns ALL matches: finished, in-progress,
 * and scheduled.
 *
 * Robustness:
 *  - &limit=300 so a busy day is never truncated
 *  - small delay between day requests to avoid rate limiting
 *  - per-day failures are collected (not silently dropped) and reported
 *    via /api/diagnostics
 *
 * Returns { records, errors }.
 */
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dateRange() {
  const days = [];
  const start = new Date('2026-06-11T00:00:00Z');
  for (let i = 0; i < 40; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    days.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }
  return days;
}

function inferStage(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('round of 32') || l.includes('1st round')) return 'LAST_32';
  if (l.includes('round of 16')) return 'LAST_16';
  if (l.includes('quarter')) return 'QUARTER_FINALS';
  if (l.includes('semi')) return 'SEMI_FINALS';
  if (l.includes('third') || l.includes('3rd place')) return 'THIRD_PLACE';
  if (l.includes('final')) return 'FINAL';
  return 'GROUP_STAGE';
}

async function fetchResults() {
  const records = [];
  const errors = [];
  for (const d of dateRange()) {
    try {
      const res = await fetch(`${BASE}?dates=${d}&limit=300`);
      if (!res.ok) { errors.push(`${d}: HTTP ${res.status}`); await sleep(120); continue; }
      const data = await res.json();
      (data.events || []).forEach((ev) => {
        const comp = ev.competitions && ev.competitions[0];
        if (!comp) return;
        const home = (comp.competitors || []).find((c) => c.homeAway === 'home');
        const away = (comp.competitors || []).find((c) => c.homeAway === 'away');
        if (!home || !away) return;
        const label =
          (comp.notes && comp.notes[0] && comp.notes[0].headline) ||
          (ev.season && ev.season.slug) || ev.name || '';
        const st = ev.status && ev.status.type && ev.status.type.state; // pre/in/post
        records.push({
          stage: inferStage(label),
          homeName: teamName(home),
          awayName: teamName(away),
          homeGoals: home.score != null ? Number(home.score) : null,
          awayGoals: away.score != null ? Number(away.score) : null,
          status: st === 'in' ? 'IN_PLAY' : st === 'post' ? 'FINISHED' : 'SCHEDULED',
          winnerName: home.winner ? teamName(home) : away.winner ? teamName(away) : null,
          utcDate: ev.date
        });
      });
    } catch (e) {
      errors.push(`${d}: ${e.message}`);
    }
    await sleep(120); // be gentle on the public endpoint
  }
  return { records, errors };
}

function teamName(c) {
  return c.team && (c.team.displayName || c.team.name || c.team.shortDisplayName);
}

module.exports = { fetchResults };
