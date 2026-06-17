'use strict';
/**
 * worldcup26.ir provider — REAL World Cup 2026 data (teams, all 104 games,
 * live scores, standings inputs, stadiums). No key needed for read access.
 * Docs/shape: https://github.com/rezarahiminia/worldcup2026
 *
 *   DATA_SOURCE=worldcup26
 *   WC26_TOKEN=<optional JWT>   # only if the host starts requiring auth
 *
 * Returns a full SNAPSHOT { teams, matches, champion, errors } that replaces
 * the in-memory state each refresh (the API is the source of truth).
 */
const BASE = process.env.WC26_BASE || 'https://worldcup26.ir';

function headers() {
  const t = process.env.WC26_TOKEN;
  return t ? { Authorization: 'Bearer ' + t } : {};
}

async function getJson(path) {
  const res = await fetch(BASE + path, { headers: headers() });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

const ROUND = {
  group: null, r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-final', sf: 'Semi-final', third: 'Third place', final: 'Final'
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statusOf(g) {
  const finished = String(g.finished).toUpperCase() === 'TRUE';
  const te = String(g.time_elapsed || '').trim().toLowerCase();
  if (finished) return 'FINISHED';
  if (te && te !== 'notstarted' && te !== 'null' && te !== '') return 'IN_PROGRESS';
  return 'SCHEDULED';
}

function toISO(localDate) {
  // "06/11/2026 13:00" -> ISO (best effort; used for sorting/display)
  try {
    const [d, t] = String(localDate).split(' ');
    const [mm, dd, yyyy] = d.split('/');
    return new Date(`${yyyy}-${mm}-${dd}T${t || '00:00'}:00`).toISOString();
  } catch { return null; }
}

function normalize(teamsArr, games, stadArr) {
  const errors = [];
  const teams = (teamsArr || []).map((t) => ({
    id: 'wc' + t.id,
    apiId: String(t.id),
    name: t.name_en,
    code: t.fifa_code,
    flag: t.flag,                 // URL — frontend renders as <img>
    group: t.groups
  }));
  const byId = Object.fromEntries(teams.map((t) => [t.apiId, t]));
  const venues = Object.fromEntries((stadArr || []).map((s) => [String(s.id), s.name_en || s.fifa_name]));

  let champion = null;
  const matches = (games || []).map((g) => {
    const type = String(g.type || 'group').toLowerCase();
    const phase = type === 'group' ? 'GROUP' : 'KNOCKOUT';
    const round = type === 'group' ? 'Group ' + g.group : (ROUND[type] || g.group);
    const status = statusOf(g);
    const homeT = g.home_team_id && g.home_team_id !== '0' ? byId[String(g.home_team_id)] : null;
    const awayT = g.away_team_id && g.away_team_id !== '0' ? byId[String(g.away_team_id)] : null;
    const homeGoals = status === 'SCHEDULED' ? null : num(g.home_score);
    const awayGoals = status === 'SCHEDULED' ? null : num(g.away_score);

    let winnerId = null;
    if (phase === 'KNOCKOUT' && status === 'FINISHED' && homeT && awayT) {
      if (homeGoals > awayGoals) winnerId = homeT.id;
      else if (awayGoals > homeGoals) winnerId = awayT.id;
    }
    if (type === 'final' && status === 'FINISHED' && winnerId) champion = winnerId;

    return {
      id: 'wc' + g.id,
      phase, group: type === 'group' ? g.group : null, round,
      homeId: homeT ? homeT.id : null,
      awayId: awayT ? awayT.id : null,
      homeLabel: g.home_team_name_en || g.home_team_label || 'TBD',
      awayLabel: g.away_team_name_en || g.away_team_label || 'TBD',
      homeGoals, awayGoals, winnerId,
      status,
      minute: status === 'IN_PROGRESS' ? String(g.time_elapsed || '').trim() : null,
      kickoff: toISO(g.local_date),
      localDate: g.local_date,
      venue: venues[String(g.stadium_id)] || null,
      matchday: g.matchday
    };
  });

  return { teams, matches, champion, errors };
}

async function fetchSnapshot() {
  const errors = [];
  const teamsRaw = await getJson('/get/teams');
  const teamsArr = Array.isArray(teamsRaw) ? teamsRaw : (teamsRaw.teams || teamsRaw.data || []);

  let stadArr = [];
  try {
    const stadRaw = await getJson('/get/stadiums');
    stadArr = Array.isArray(stadRaw) ? stadRaw : (stadRaw.stadiums || stadRaw.data || []);
  } catch (e) { errors.push('stadiums: ' + e.message); }

  const gamesRaw = await getJson('/get/games');
  const games = Array.isArray(gamesRaw) ? gamesRaw : (gamesRaw.games || gamesRaw.data || []);

  const snap = normalize(teamsArr, games, stadArr);
  snap.errors = snap.errors.concat(errors);
  return snap;
}

module.exports = { fetchSnapshot, normalize };
