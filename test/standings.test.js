'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { computeStandings } = require('../src/engine/standings');

const teamIds = ['a', 'b', 'c', 'd'];
const m = (homeId, awayId, hg, ag) => ({
  phase: 'GROUP', group: 'A', homeId, awayId, homeGoals: hg, awayGoals: ag, status: 'FINISHED'
});

test('empty group => all zero rows', () => {
  const t = computeStandings(teamIds, []);
  assert.equal(t.length, 4);
  assert.equal(t[0].Pts, 0);
});

test('a win awards 3 points and updates goal stats', () => {
  const t = computeStandings(teamIds, [m('a', 'b', 2, 0)]);
  const a = t.find((r) => r.teamId === 'a');
  const b = t.find((r) => r.teamId === 'b');
  assert.equal(a.Pts, 3);
  assert.equal(a.W, 1);
  assert.equal(a.GF, 2);
  assert.equal(a.GD, 2);
  assert.equal(b.Pts, 0);
  assert.equal(b.L, 1);
});

test('a draw awards 1 point each', () => {
  const t = computeStandings(teamIds, [m('a', 'b', 1, 1)]);
  assert.equal(t.find((r) => r.teamId === 'a').Pts, 1);
  assert.equal(t.find((r) => r.teamId === 'b').Pts, 1);
});

test('ordering uses points then goal difference', () => {
  const matches = [m('a', 'b', 1, 0), m('c', 'd', 5, 0)];
  const t = computeStandings(teamIds, matches);
  // a and c both have 3 pts; c has better GD, so c ranks first
  assert.equal(t[0].teamId, 'c');
  assert.equal(t[0].rank, 1);
});

test('unfinished matches are ignored', () => {
  const pending = { phase: 'GROUP', group: 'A', homeId: 'a', awayId: 'b', homeGoals: null, awayGoals: null, status: 'SCHEDULED' };
  const t = computeStandings(teamIds, [pending]);
  assert.equal(t[0].P, 0);
});
