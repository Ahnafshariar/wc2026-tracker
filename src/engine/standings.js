'use strict';
/**
 * Pure standings logic. No I/O, fully unit-testable.
 * Points: win = 3, draw = 1, loss = 0.
 * Tiebreakers (simplified): points, goal difference, goals for, name.
 */

function emptyRow(teamId) {
  return { teamId, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
}

function isFinished(m) {
  return m.status === 'FINISHED' && m.homeGoals != null && m.awayGoals != null;
}

/**
 * @param {string[]} teamIds   team ids in the group
 * @param {object[]} matches   matches belonging to the group
 * @returns {object[]} sorted standings rows (best first), each tagged with rank
 */
function computeStandings(teamIds, matches) {
  const table = {};
  teamIds.forEach((id) => { table[id] = emptyRow(id); });

  matches.filter(isFinished).forEach((m) => {
    const h = table[m.homeId];
    const a = table[m.awayId];
    if (!h || !a) return;
    h.P++; a.P++;
    h.GF += m.homeGoals; h.GA += m.awayGoals;
    a.GF += m.awayGoals; a.GA += m.homeGoals;
    if (m.homeGoals > m.awayGoals) { h.W++; h.Pts += 3; a.L++; }
    else if (m.homeGoals < m.awayGoals) { a.W++; a.Pts += 3; h.L++; }
    else { h.D++; a.D++; h.Pts++; a.Pts++; }
  });

  const rows = Object.values(table);
  rows.forEach((r) => { r.GD = r.GF - r.GA; });
  rows.sort((x, y) =>
    y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.teamId.localeCompare(y.teamId)
  );
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

module.exports = { computeStandings, isFinished };
