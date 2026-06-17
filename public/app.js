'use strict';

/* ─────────────────────────────────────────────────────────────────
   SELF-UPDATING WORLD CUP 2026 TRACKER (worldcup26.ir live data)
   Primary:  Server-Sent Events — server pushes on every refresh.
   Fallback: polling every 30 s if SSE is unavailable.
───────────────────────────────────────────────────────────────── */

const $ = (s) => document.querySelector(s);
const api = (p) => fetch('/api/' + p).then((r) => r.json());

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $('#' + t.dataset.tab).classList.add('active');
  });
});

// ── flag rendering: real flags are URLs (https://flagcdn.com/...) ──
function flag(f) {
  if (f && /^https?:\/\//.test(f)) {
    return `<img class="flag" src="${f}" alt="" loading="lazy" onerror="this.style.display='none'">`;
  }
  return `<span class="flag-emoji">${f || '🏳️'}</span>`;
}

function teamSide(team, align) {
  const name = `<span class="tname">${team.name}</span>`;
  return align === 'away'
    ? `<div class="side away">${name} ${flag(team.flag)}</div>`
    : `<div class="side home">${flag(team.flag)} ${name}</div>`;
}

function fmtDate(iso, localDate) {
  if (localDate) return localDate;                 // API's own "06/11/2026 13:00"
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(); } catch { return ''; }
}

function matchRow(m) {
  let mid;
  if (m.status === 'IN_PROGRESS') {
    mid = `<div class="score live-score">${m.homeGoals ?? 0}&ndash;${m.awayGoals ?? 0}
             <span class="badge live">${m.minute ? m.minute + "'" : 'LIVE'}</span></div>`;
  } else if (m.status === 'FINISHED') {
    mid = `<div class="score">${m.homeGoals ?? 0}&ndash;${m.awayGoals ?? 0}
             <span class="badge ft">FT</span></div>`;
  } else {
    mid = `<div class="score sched"><span class="kick">${fmtDate(m.kickoff, m.localDate)}</span></div>`;
  }
  const pens = m.penalties
    ? `<small class="pens">pens: ${m.penalties === 'home' ? m.home.name : m.away.name}</small>` : '';
  const venue = m.venue ? `<small class="venue">📍 ${m.venue}</small>` : '';
  return `<div class="match">${teamSide(m.home, 'home')}${mid}${teamSide(m.away, 'away')}</div>${pens}${venue}`;
}

// ── status bar ────────────────────────────────────────────────────
async function renderStatus() {
  const [state, source] = await Promise.all([api('state'), api('source')]);
  const label = {
    worldcup26: '📡 live · worldcup26.ir', footballdata: '📡 live · football-data',
    espn: '📡 live · ESPN', demo: '🧪 demo', static: '📅 fixtures'
  };
  $('#source').textContent = label[source.mode] || source.mode;
  $('#phase').textContent = state.phase === 'DONE' ? '✅ complete'
    : state.phase === 'KNOCKOUT' ? '🏟 ' + (state.knockoutRound || 'knockout') : '📊 group stage';
  $('#progress').textContent = `${state.counts.finished}/${state.counts.total} played · ${state.counts.live} live`;
  const liveTab = document.querySelector('.tab[data-tab="live"]');
  if (liveTab) liveTab.innerHTML = state.counts.live > 0
    ? `<span class="live-dot"></span> Live (${state.counts.live})` : '⚽ Matches';
  const champ = $('#champion');
  if (state.champion) {
    champ.classList.remove('hidden');
    champ.innerHTML = `🏆 WORLD CHAMPIONS: ${flag(state.champion.flag)} <strong>${state.champion.name}</strong>`;
  } else champ.classList.add('hidden');
}

// ── Matches tab: LIVE NOW + RESULTS (all) + UPCOMING ──────────────
async function renderLive() {
  const all = await api('fixtures');
  const live = all.filter((m) => m.status === 'IN_PROGRESS');
  const done = all.filter((m) => m.status === 'FINISHED')
    .sort((a, b) => (b.kickoff || '').localeCompare(a.kickoff || ''));      // most recent first
  const next = all.filter((m) => m.status === 'SCHEDULED')
    .sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || ''))
    .slice(0, 12);

  let html = '<div class="grid">';
  html += `<div class="card live-card"><h3>🔴 Live now</h3>${
    live.length ? live.map(matchRow).join('') : '<p class="empty">No matches in progress right now.</p>'}</div>`;
  html += `<div class="card"><h3>✅ Results <small>(${done.length})</small></h3>${
    done.length ? done.map(matchRow).join('') : '<p class="empty">No completed matches yet.</p>'}</div>`;
  html += `<div class="card"><h3>📅 Upcoming</h3>${
    next.length ? next.map(matchRow).join('') : '<p class="empty">No upcoming matches scheduled.</p>'}</div>`;
  html += '</div>';
  $('#live').innerHTML = html;
}

async function renderGroups() {
  const groups = await api('standings');
  if (!groups.length) { $('#groups').innerHTML = '<p class="empty">Standings loading…</p>'; return; }
  $('#groups').innerHTML = '<div class="grid">' + groups.map((g) => `
    <div class="card"><h3>Group ${g.letter}</h3>
      <table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
      <tbody>${g.table.map((r) => `
        <tr class="${r.rank <= 2 ? 'qual' : ''}">
          <td class="pos">${r.rank}</td>
          <td class="tcell">${flag(r.flag)} ${r.name}</td>
          <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
          <td>${r.GD > 0 ? '+' + r.GD : r.GD}</td><td class="pts">${r.Pts}</td>
        </tr>`).join('')}</tbody></table>
      <p class="qual-note">🟢 top 2 advance</p>
    </div>`).join('') + '</div>';
}

async function renderFixtures() {
  const all = await api('fixtures');
  const byRound = {};
  all.forEach((m) => { (byRound[m.round] = byRound[m.round] || []).push(m); });
  $('#fixtures').innerHTML = '<div class="grid">' +
    Object.entries(byRound).map(([round, ms]) =>
      `<div class="card"><h3>${round}</h3>${ms.map(matchRow).join('')}</div>`).join('') + '</div>';
}

async function renderBracket() {
  const rounds = await api('bracket');
  const order = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third place', 'Final'];
  const el = $('#bracket');
  if (!Object.keys(rounds).length) { el.innerHTML = '<p class="empty">Knockout bracket appears after the group stage.</p>'; return; }
  el.innerHTML = '<div class="bracket">' + order.filter((r) => rounds[r]).map((r) => `
    <div class="round"><h4>${r}</h4>${rounds[r].map((m) => {
      const hw = m.winnerId && m.winnerId === m.home.id;
      const aw = m.winnerId && m.winnerId === m.away.id;
      const sc = m.status !== 'SCHEDULED' ? `${m.homeGoals ?? 0}&ndash;${m.awayGoals ?? 0}` : 'v';
      return `<div class="card bcard">
        <span class="${hw ? 'win' : ''}">${flag(m.home.flag)} ${m.home.name}</span>
        <small class="bscore">${sc}</small>
        <span class="${aw ? 'win' : ''}">${flag(m.away.flag)} ${m.away.name}</span>
      </div>`;
    }).join('')}</div>`).join('') + '</div>';
}

async function renderTeams() {
  const teams = await api('teams');
  const byGroup = {};
  teams.forEach((t) => { (byGroup[t.group] = byGroup[t.group] || []).push(t); });
  $('#teams').innerHTML = '<div class="grid">' +
    Object.entries(byGroup).sort().map(([g, ts]) =>
      `<div class="card"><h3>Group ${g}</h3>${ts.map((t) =>
        `<span class="teamchip">${flag(t.flag)} ${t.name}</span>`).join('')}</div>`).join('') + '</div>';
}

let rendering = false;
async function refresh() {
  if (rendering) return;
  rendering = true;
  try {
    await Promise.all([renderStatus(), renderLive(), renderGroups(), renderFixtures(), renderBracket(), renderTeams()]);
  } catch (e) { console.warn('refresh error', e); }
  finally { rendering = false; }
}

// ── SSE ───────────────────────────────────────────────────────────
let fallbackTimer = null;
function startFallback() { if (!fallbackTimer) fallbackTimer = setInterval(refresh, 30000); }
function stopFallback() { if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; } }
function setConnBadge(ok) {
  const el = $('#conn-badge'); if (!el) return;
  el.textContent = ok ? '🟢 live updates' : '🟡 reconnecting…';
  el.className = 'pill ' + (ok ? 'conn-ok' : 'conn-warn');
}
function connectSSE() {
  if (!window.EventSource) { startFallback(); return; }
  const es = new EventSource('/api/stream');
  const onData = () => { stopFallback(); refresh(); };
  es.addEventListener('update', onData);
  es.addEventListener('reset', onData);
  es.onopen = () => { stopFallback(); setConnBadge(true); };
  es.onerror = () => { setConnBadge(false); startFallback(); };
}

refresh();
connectSSE();
