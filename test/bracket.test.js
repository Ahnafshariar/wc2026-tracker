'use strict';
const test = require('node:test');
const assert = require('node:assert');
const sim = require('../src/engine/simulator');
const { qualifiers, pairRound } = require('../src/engine/bracket');

test('pairRound creates n/2 matches with correct seeding', () => {
  const r = pairRound(['t1', 't2', 't3', 't4'], 'Round of 32', 1);
  assert.equal(r.length, 2);
  assert.equal(r[0].homeId, 't1');
  assert.equal(r[0].awayId, 't4');
  assert.equal(r[1].homeId, 't2');
  assert.equal(r[1].awayId, 't3');
});

test('simulator runs the whole tournament to a single champion', () => {
  sim.reset();
  // tick enough times to resolve every group + knockout match (2 ticks/match)
  for (let i = 0; i < 1000; i++) {
    const s = sim.tick();
    if (s.phase === 'DONE') break;
  }
  const state = sim.getState();
  assert.equal(state.phase, 'DONE');
  assert.ok(state.champion, 'a champion should be set');
  assert.ok(state.teams.some((t) => t.id === state.champion), 'champion is a real team');
});

test('exactly 32 teams qualify after the group stage', () => {
  sim.reset();
  // resolve only group stage
  let guard = 0;
  while (sim.getState().phase === 'GROUP' && guard++ < 1000) sim.tick();
  const q = qualifiers(sim.getState().groups, sim.getState().matches);
  assert.equal(q.winners.length, 12);
  assert.equal(q.runners.length, 12);
  assert.equal(q.bestThirds.length, 8);
  assert.equal(q.all.length, 32);
});
