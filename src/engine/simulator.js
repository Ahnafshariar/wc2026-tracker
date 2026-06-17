'use strict';
/**
 * In-memory tournament state + a simulator that advances the tournament
 * over time so the deployed app visibly updates: group games resolve,
 * standings recompute, the knockout bracket fills in, and a champion emerges.
 *
 * Single-instance only. For multiple EC2 instances behind a load balancer,
 * back this with a shared store (Redis/DB).
 */

const { buildSeed } = require('../data/seed');
const { computeStandings } = require('./standings');
const bus = require('./eventBus');   // SSE push to all browser clients
const { qualifiers, pairRound, nextRoundName } = require('./bracket');

let state;

function reset() {
  const seed = buildSeed();
  state = {
    teams: seed.teams,
    groups: seed.groups,
    matches: seed.matches,        // group matches; knockout appended later
    phase: 'GROUP',               // GROUP -> KNOCKOUT -> DONE
    knockoutRound: null,
    champion: null,
    updatedAt: new Date().toISOString()
  };
  bus.emit('reset', { phase: state.phase, updatedAt: state.updatedAt });
  return state;
}

function teamName(id) {
  const t = state.teams.find((x) => x.id === id);
  return t ? t.name : id;
}

// how the auto-tournament behaves (overridable via env)
const CONCURRENT = parseInt(process.env.SIM_CONCURRENT || '2', 10);  // live matches at once
const LIVE_TICKS = parseInt(process.env.SIM_LIVE_TICKS || '3', 10);  // ticks a match stays "LIVE"

/** While a match is live, occasionally add a goal so the score moves. */
function maybeScore(match) {
  if (Math.random() < 0.45) {
    if (Math.random() < 0.5) match.homeGoals++; else match.awayGoals++;
    return true;
  }
  return false;
}

/** Finalize a live match using its accumulated score; settle knockout ties on pens. */
function finalizeLive(match) {
  match.status = 'FINISHED';
  match.finishedAt = new Date().toISOString();
  if (match.phase === 'KNOCKOUT') {
    if (match.homeGoals === match.awayGoals) {
      match.penalties = Math.random() < 0.5 ? 'home' : 'away';
      match.winnerId = match.penalties === 'home' ? match.homeId : match.awayId;
    } else {
      match.winnerId = match.homeGoals > match.awayGoals ? match.homeId : match.awayId;
    }
  }
}

function buildKnockout() {
  const q = qualifiers(state.groups, state.matches);
  // Clean seeded order: winners, then best thirds, then runners-up.
  const seedOrder = [
    ...q.winners.map((r) => r.teamId),
    ...q.bestThirds.map((r) => r.teamId),
    ...q.runners.map((r) => r.teamId)
  ].slice(0, 32);
  const r32 = pairRound(seedOrder, 'Round of 32', 1);
  state.matches.push(...r32);
  state.phase = 'KNOCKOUT';
  state.knockoutRound = 'Round of 32';
}

function advanceKnockoutRound() {
  const current = state.knockoutRound;
  const roundMatches = state.matches.filter((m) => m.phase === 'KNOCKOUT' && m.round === current);
  const winners = roundMatches.map((m) => m.winnerId);
  const next = nextRoundName(current);
  if (!next) {
    // current was the Final
    state.champion = roundMatches[0].winnerId;
    state.phase = 'DONE';
    state.knockoutRound = null;
    return;
  }
  const startNo = state.matches.filter((m) => m.phase === 'KNOCKOUT').length + 1;
  const nextMatches = pairRound(winners, next, startNo);
  state.matches.push(...nextMatches);
  state.knockoutRound = next;
}

/**
 * One simulation step. Keeps up to CONCURRENT matches LIVE for LIVE_TICKS each,
 * scoring as they go, then finalizes them — so the UI always shows running
 * matches, a growing results list, live group tables, and an advancing bracket.
 */
function tick() {
  if (!state) reset();
  if (state.phase === 'DONE') return state;
  let changed = false;

  // 1) progress / finalize currently-live matches
  state.matches.filter((m) => m.status === 'IN_PROGRESS').forEach((m) => {
    m.ticksLive = (m.ticksLive || 0) + 1;
    if (maybeScore(m)) changed = true;
    if (m.ticksLive >= LIVE_TICKS) { finalizeLive(m); changed = true; }
  });

  // 2) phase / round transitions
  if (state.phase === 'GROUP') {
    const groupLeft = state.matches.some((m) => m.phase === 'GROUP' && m.status !== 'FINISHED');
    const noKnockoutYet = !state.matches.some((m) => m.phase === 'KNOCKOUT');
    if (!groupLeft && noKnockoutYet) { buildKnockout(); changed = true; }
  }
  if (state.phase === 'KNOCKOUT') {
    const roundMatches = state.matches.filter((m) => m.phase === 'KNOCKOUT' && m.round === state.knockoutRound);
    if (roundMatches.length && roundMatches.every((m) => m.status === 'FINISHED')) {
      advanceKnockoutRound(); changed = true;
    }
  }

  // 3) start new live matches up to CONCURRENT (current phase / round only)
  if (state.phase !== 'DONE') {
    const phase = state.phase === 'GROUP' ? 'GROUP' : 'KNOCKOUT';
    let liveCount = state.matches.filter((m) => m.status === 'IN_PROGRESS').length;
    while (liveCount < CONCURRENT) {
      const next = state.matches.find((m) =>
        m.phase === phase && m.status === 'SCHEDULED' &&
        (phase !== 'KNOCKOUT' || m.round === state.knockoutRound));
      if (!next) break;
      next.status = 'IN_PROGRESS';
      next.homeGoals = 0;
      next.awayGoals = 0;
      next.ticksLive = 0;
      next.kickoffActual = new Date().toISOString();
      liveCount++; changed = true;
    }
  }

  state.updatedAt = new Date().toISOString();
  if (changed) pushUpdate();
  return state;
}

/** Push a concise summary to all SSE subscribers after any state change. */
function pushUpdate() {
  bus.emit('update', {
    phase: state.phase,
    knockoutRound: state.knockoutRound,
    champion: state.champion,
    updatedAt: state.updatedAt,
    counts: {
      total: state.matches.length,
      finished: state.matches.filter((m) => m.status === 'FINISHED').length,
      live: state.matches.filter((m) => m.status === 'IN_PROGRESS').length
    }
  });
}

function getState() {
  if (!state) reset();
  return state;
}

/** Standings for every group, computed live. */
function getStandings() {
  return getState().groups.map((g) => ({
    letter: g.letter,
    table: computeStandings(
      g.teamIds,
      state.matches.filter((m) => m.phase === 'GROUP' && m.group === g.letter)
    ).map((r) => ({ ...r, name: teamName(r.teamId), flag: flagOf(r.teamId) }))
  }));
}

function flagOf(id) {
  const t = getState().teams.find((x) => x.id === id);
  return t ? t.flag : '🏳️';
}

/* ----------------------------------------------------------------------
 * LIVE DATA INGESTION
 * Overlay real results (from a provider) onto the real bundled fixtures.
 * Group results are matched to bundled fixtures by team-name pair; knockout
 * matches are taken directly from the provider (real bracket + results).
 * -------------------------------------------------------------------- */

const ALIAS = {
  'united states': 'USA', 'united states of america': 'USA', 'usmnt': 'USA',
  'korea republic': 'South Korea', 'republic of korea': 'South Korea', 'south korea': 'South Korea',
  'ir iran': 'Iran', 'iran islamic republic of': 'Iran', 'islamic republic of iran': 'Iran',
  'ivory coast': "Côte d'Ivoire", 'cote divoire': "Côte d'Ivoire", 'cote d ivoire': "Côte d'Ivoire",
  'turkey': 'Türkiye', 'turkiye': 'Türkiye',
  'cabo verde': 'Cape Verde', 'cape verde islands': 'Cape Verde',
  'congo dr': 'DR Congo', 'dr congo': 'DR Congo', 'democratic republic of congo': 'DR Congo',
  'democratic republic of the congo': 'DR Congo', 'congo democratic republic': 'DR Congo', 'congo kinshasa': 'DR Congo',
  'bosnia and herzegovina': 'Bosnia & Herzegovina', 'bosnia herzegovina': 'Bosnia & Herzegovina', 'bosnia': 'Bosnia & Herzegovina',
  'czech republic': 'Czechia', 'czechia': 'Czechia',
  'curacao': 'Curaçao',
  'south africa': 'South Africa', 'rsa': 'South Africa',
  'new zealand': 'New Zealand', 'saudi arabia': 'Saudi Arabia', 'ksa': 'Saudi Arabia'
};

// diagnostics from the most recent live ingest — surfaced at /api/diagnostics
let lastIngest = { matched: 0, skipped: 0, unmatched: [], at: null };
function getIngestDiag() { return lastIngest; }

function strip(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonName(name) {
  const k = strip(name);
  if (ALIAS[k]) return ALIAS[k];
  const t = getState().teams.find((x) => strip(x.name) === k);
  return t ? t.name : null;
}
function teamIdByName(name) {
  const cn = canonName(name);
  const t = cn && getState().teams.find((x) => x.name === cn);
  return t ? t.id : null;
}

function mapStatus(s) {
  const v = String(s || '').toUpperCase();
  if (['IN_PLAY', 'PAUSED', 'LIVE', 'IN'].includes(v)) return 'IN_PROGRESS';
  if (['FINISHED', 'FT', 'POST', 'COMPLETE', 'COMPLETED'].includes(v)) return 'FINISHED';
  return 'SCHEDULED';
}

const STAGE_ROUND = {
  LAST_32: 'Round of 32', ROUND_OF_32: 'Round of 32',
  LAST_16: 'Round of 16', ROUND_OF_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-final', QUARTERFINALS: 'Quarter-final',
  SEMI_FINALS: 'Semi-final', SEMIFINALS: 'Semi-final',
  THIRD_PLACE: 'Third place', FINAL: 'Final'
};

/** records: [{ stage, homeName, awayName, homeGoals, awayGoals, status, winnerName, utcDate }] */
function ingestLive(records) {
  const s = getState();
  const diag = { matched: 0, skipped: 0, unmatched: new Set(), at: new Date().toISOString() };

  records.forEach((r) => {
    const homeId = teamIdByName(r.homeName);
    const awayId = teamIdByName(r.awayName);
    if (!homeId || !awayId) {
      diag.skipped++;
      if (!homeId && r.homeName) diag.unmatched.add(r.homeName);
      if (!awayId && r.awayName) diag.unmatched.add(r.awayName);
      return; // can't place this match — recorded in diagnostics, not silently lost
    }
    diag.matched++;
    const status = mapStatus(r.status);
    const stage = String(r.stage || '').toUpperCase();

    if (stage === 'GROUP_STAGE' || stage === 'GROUP' || stage === '') {
      const m = s.matches.find((x) => x.phase === 'GROUP' &&
        ((x.homeId === homeId && x.awayId === awayId) || (x.homeId === awayId && x.awayId === homeId)));
      if (m) {
        const flip = m.homeId !== homeId;
        m.homeGoals = flip ? num(r.awayGoals) : num(r.homeGoals);
        m.awayGoals = flip ? num(r.homeGoals) : num(r.awayGoals);
        m.status = status;
        if (r.utcDate) m.kickoff = r.utcDate;
      }
    } else {
      const round = STAGE_ROUND[stage] || 'Knockout';
      const id = 'k_' + [strip(r.homeName), strip(r.awayName)].sort().join('_');
      let m = s.matches.find((x) => x.id === id);
      if (!m) {
        m = { id, phase: 'KNOCKOUT', round, homeId, awayId, homeGoals: null, awayGoals: null, winnerId: null, status: 'SCHEDULED' };
        s.matches.push(m);
      }
      m.round = round;
      m.homeGoals = num(r.homeGoals);
      m.awayGoals = num(r.awayGoals);
      m.status = status;
      if (r.utcDate) m.kickoff = r.utcDate;
      if (status === 'FINISHED') {
        m.winnerId = r.winnerName ? teamIdByName(r.winnerName)
          : (m.homeGoals > m.awayGoals ? homeId : m.awayGoals > m.homeGoals ? awayId : null);
        if (round === 'Final' && m.winnerId) { s.champion = m.winnerId; s.phase = 'DONE'; }
      }
    }
  });

  if (s.matches.some((m) => m.phase === 'KNOCKOUT')) {
    if (s.phase === 'GROUP') s.phase = 'KNOCKOUT';
    const ko = s.matches.filter((m) => m.phase === 'KNOCKOUT');
    s.knockoutRound = ko[ko.length - 1].round;
  }
  s.source = 'live';
  s.updatedAt = new Date().toISOString();
  lastIngest = { matched: diag.matched, skipped: diag.skipped, unmatched: [...diag.unmatched], at: diag.at };
  pushUpdate();
  return s;
}

function num(v) { return v == null || v === '' ? null : Number(v); }

/* ----------------------------------------------------------------------
 * FULL SNAPSHOT LOAD (worldcup26.ir provider)
 * The API returns the complete picture (teams + all 104 games), so we
 * replace state wholesale and recompute standings from finished games.
 * -------------------------------------------------------------------- */
const KO_ORDER = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third place', 'Final'];

function loadSnapshot(snap) {
  const groupsMap = {};
  snap.teams.forEach((t) => {
    if (/^[A-L]$/.test(t.group)) (groupsMap[t.group] = groupsMap[t.group] || []).push(t.id);
  });
  const groups = Object.keys(groupsMap).sort().map((letter) => ({ letter, teamIds: groupsMap[letter] }));

  const groupMatches = snap.matches.filter((m) => m.phase === 'GROUP');
  const allGroupDone = groupMatches.length > 0 && groupMatches.every((m) => m.status === 'FINISHED');
  const koStarted = snap.matches.some((m) => m.phase === 'KNOCKOUT' && m.status !== 'SCHEDULED');

  let phase = 'GROUP';
  if (snap.champion) phase = 'DONE';
  else if (koStarted || allGroupDone) phase = 'KNOCKOUT';

  let knockoutRound = null;
  for (const r of KO_ORDER) {
    if (snap.matches.some((m) => m.round === r && m.status !== 'SCHEDULED')) knockoutRound = r;
  }
  if (!knockoutRound) for (const r of KO_ORDER) {
    if (snap.matches.some((m) => m.round === r)) { knockoutRound = r; break; }
  }

  state = {
    teams: snap.teams,
    groups,
    matches: snap.matches,
    phase,
    knockoutRound: phase === 'GROUP' ? null : knockoutRound,
    champion: snap.champion || null,
    source: 'live',
    updatedAt: new Date().toISOString()
  };

  const live = snap.matches.filter((m) => m.status === 'IN_PROGRESS').length;
  const finished = snap.matches.filter((m) => m.status === 'FINISHED').length;
  lastIngest = { matched: snap.matches.length, skipped: 0, unmatched: [], at: state.updatedAt, live, finished };
  pushUpdate();
  return state;
}

module.exports = { reset, tick, getState, getStandings, teamName, flagOf, ingestLive, canonName, pushUpdate, bus, getIngestDiag, loadSnapshot };
