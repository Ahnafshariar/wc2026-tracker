'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { normalize } = require('../src/providers/worldcup26');
const sim = require('../src/engine/simulator');

const fx = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f + '.json'), 'utf8'));

test('worldcup26 normalize maps the real API shape to 104 matches + 48 teams', () => {
  const snap = normalize(fx('teams'), fx('matches'), fx('stadiums'));
  assert.equal(snap.teams.length, 48);
  assert.equal(snap.matches.length, 104);
  // knockout TBD slots carry labels, not team ids
  const r32 = snap.matches.find((m) => m.round === 'Round of 32');
  assert.ok(r32, 'has a Round of 32 match');
  assert.ok(r32.homeId === null || r32.homeLabel, 'TBD slot has a label');
});

test('finished + live matches drive standings and live view', () => {
  const teams = fx('teams');
  const stadiums = fx('stadiums');
  const games = fx('matches');
  // make match 1 (Group A, team 1 vs 2) a finished 2-1, and match 2 in progress
  const g1 = games.find((g) => g.id === '1');
  g1.finished = 'TRUE'; g1.home_score = '2'; g1.away_score = '1'; g1.time_elapsed = '90';
  const g2 = games.find((g) => g.id === '2');
  g2.finished = 'FALSE'; g2.time_elapsed = '63'; g2.home_score = '1'; g2.away_score = '0';

  const snap = normalize(teams, games, stadiums);
  sim.loadSnapshot(snap);

  // live view shows the in-progress game with a minute
  const live = sim.getState().matches.filter((m) => m.status === 'IN_PROGRESS');
  assert.equal(live.length, 1);
  assert.equal(live[0].minute, '63');

  // Group A standings: team 1 should now have 3 points from the 2-1 win
  const groupA = sim.getStandings().find((g) => g.letter === 'A');
  const winner = groupA.table.find((r) => r.Pts === 3);
  assert.ok(winner, 'a team has 3 points after a win');
  assert.equal(winner.GF, 2);
});
