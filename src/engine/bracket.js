'use strict';
/**
 * Knockout logic for the 2026 format: 12 group winners + 12 runners-up
 * + the 8 best third-placed teams = 32 teams in a single-elimination bracket.
 * NOTE: the official R32 pairing table is more intricate; this uses a clean,
 * documented seeding suitable for a demo.
 */

const { computeStandings } = require('./standings');

function qualifiers(groups, matches) {
  const winners = [];
  const runners = [];
  const thirds = [];

  groups.forEach((g) => {
    const groupMatches = matches.filter((m) => m.phase === 'GROUP' && m.group === g.letter);
    const table = computeStandings(g.teamIds, groupMatches);
    if (table[0]) winners.push({ ...table[0], group: g.letter, slot: '1' + g.letter });
    if (table[1]) runners.push({ ...table[1], group: g.letter, slot: '2' + g.letter });
    if (table[2]) thirds.push({ ...table[2], group: g.letter, slot: '3' + g.letter });
  });

  thirds.sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.teamId.localeCompare(b.teamId));
  const bestThirds = thirds.slice(0, 8);

  return { winners, runners, bestThirds, all: [...winners, ...runners, ...bestThirds] };
}

/** Pair a flat seeded list into matches: seed[i] vs seed[n-1-i]. */
function pairRound(teamIds, roundName, startNo) {
  const out = [];
  let no = startNo;
  for (let i = 0; i < teamIds.length / 2; i++) {
    out.push({
      id: 'k' + no,
      phase: 'KNOCKOUT',
      round: roundName,
      homeId: teamIds[i],
      awayId: teamIds[teamIds.length - 1 - i],
      homeGoals: null,
      awayGoals: null,
      winnerId: null,
      status: 'SCHEDULED'
    });
    no++;
  }
  return out;
}

const ROUNDS = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];

function nextRoundName(current) {
  const i = ROUNDS.indexOf(current);
  return i >= 0 && i < ROUNDS.length - 1 ? ROUNDS[i + 1] : null;
}

module.exports = { qualifiers, pairRound, ROUNDS, nextRoundName };
