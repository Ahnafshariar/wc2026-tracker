'use strict';
const express = require('express');
const sim = require('../engine/simulator');
const providers = require('../providers');
const { subscribe } = require('../engine/eventBus');

const router = express.Router();

router.get('/health', (req, res) => res.json({
  status: 'ok',
  uptime: Math.floor(process.uptime()),
  sseClients: sim.bus.clientCount()
}));

router.get('/source', (req, res) => res.json({ mode: providers.mode() }));

/**
 * Live-data health. Use this to see WHY matches might be missing:
 *  - fetched: how many matches the provider returned
 *  - matched/skipped: how many were placed vs dropped during ingest
 *  - unmatched: team names the provider used that didn't map (add to ALIAS)
 *  - fetchErrors: any provider/network failures
 */
router.get('/diagnostics', (req, res) => {
  const ingest = sim.getIngestDiag();
  const fetchInfo = req.app.locals.getLastFetch ? req.app.locals.getLastFetch() : {};
  res.json({
    mode: providers.mode(),
    lastFetch: fetchInfo.at || null,
    fetched: fetchInfo.fetched || 0,
    matched: ingest.matched,
    skipped: ingest.skipped,
    unmatchedTeamNames: ingest.unmatched,
    fetchErrors: fetchInfo.errors || []
  });
});

/**
 * SSE stream — the browser connects once and receives pushed events.
 * event: update  → state summary (phase, counts, champion, updatedAt)
 * event: reset   → tournament restarted
 * `: heartbeat`  → keep-alive comment every 25 s (no event fired on client)
 */
router.get('/stream', (req, res) => {
  const cleanup = subscribe(res);
  // send an immediate snapshot so the browser doesn't wait for the first real event
  sim.pushUpdate();
  req.on('close', cleanup);
});

router.get('/teams', (req, res) => {
  res.json(sim.getState().teams);
});

router.get('/fixtures', (req, res) => {
  const { phase, status, group } = req.query;
  let m = sim.getState().matches;
  if (phase) m = m.filter((x) => x.phase === phase);
  if (status) m = m.filter((x) => x.status === status);
  if (group) m = m.filter((x) => x.group === group);
  res.json(m.map(decorate));
});

router.get('/live', (req, res) => {
  const live = sim.getState().matches.filter((m) => m.status === 'IN_PROGRESS').map(decorate);
  res.json(live);
});

router.get('/standings', (req, res) => res.json(sim.getStandings()));

router.get('/bracket', (req, res) => {
  const ko = sim.getState().matches.filter((m) => m.phase === 'KNOCKOUT');
  const rounds = {};
  ko.forEach((m) => {
    (rounds[m.round] = rounds[m.round] || []).push(decorate(m));
  });
  res.json(rounds);
});

router.get('/state', (req, res) => {
  const s = sim.getState();
  res.json({
    phase: s.phase,
    knockoutRound: s.knockoutRound,
    champion: s.champion ? { id: s.champion, name: sim.teamName(s.champion), flag: sim.flagOf(s.champion) } : null,
    updatedAt: s.updatedAt,
    counts: {
      total: s.matches.length,
      finished: s.matches.filter((m) => m.status === 'FINISHED').length,
      live: s.matches.filter((m) => m.status === 'IN_PROGRESS').length
    }
  });
});

// Manual controls (handy for demos / CI smoke tests)
router.post('/tick', (req, res) => res.json({ ok: true, state: summarize(sim.tick()) }));
router.post('/reset', (req, res) => res.json({ ok: true, state: summarize(sim.reset()) }));

function decorate(m) {
  return {
    ...m,
    home: m.homeId
      ? { id: m.homeId, name: sim.teamName(m.homeId), flag: sim.flagOf(m.homeId) }
      : { id: null, name: m.homeLabel || 'TBD', flag: '🏳️' },
    away: m.awayId
      ? { id: m.awayId, name: sim.teamName(m.awayId), flag: sim.flagOf(m.awayId) }
      : { id: null, name: m.awayLabel || 'TBD', flag: '🏳️' }
  };
}

function summarize(s) {
  return { phase: s.phase, knockoutRound: s.knockoutRound, champion: s.champion };
}

module.exports = router;
