'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const apiRouter = require('./src/routes/api');
const sim = require('./src/engine/simulator');
const providers = require('./src/providers');

const app = express();
const PORT = process.env.PORT || 3000;
const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL || '30000', 10); // live poll (ms)
const SIM_INTERVAL = parseInt(process.env.SIM_INTERVAL || '4000', 10);          // demo tick (ms)

app.use(helmet({ contentSecurityPolicy: false })); // CSP off so inline demo assets load
app.use(compression());
app.use(morgan('tiny'));
app.use(express.json());

app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

sim.reset();

const dataMode = providers.mode();
const dataKind = providers.kind();
let lastFetch = { at: null, fetched: 0, errors: [] };

async function refreshLive() {
  try {
    if (dataKind === 'snapshot') {
      const snap = await providers.fetchSnapshot();
      sim.loadSnapshot(snap);
      lastFetch = { at: new Date().toISOString(), fetched: snap.matches.length, errors: snap.errors || [] };
      const d = sim.getIngestDiag();
      console.log(`[live] ${dataMode}: ${snap.matches.length} games, ${d.live} live, ${d.finished} finished`);
    } else {
      const { records, errors } = await providers.fetchResults();
      if (records.length) sim.ingestLive(records);
      lastFetch = { at: new Date().toISOString(), fetched: records.length, errors: errors || [] };
      const d = sim.getIngestDiag();
      console.log(`[live] ${dataMode}: fetched ${records.length}, matched ${d.matched}, skipped ${d.skipped}` +
        (d.unmatched.length ? ` | unmatched: ${d.unmatched.join(', ')}` : ''));
    }
  } catch (e) {
    lastFetch = { at: new Date().toISOString(), fetched: 0, errors: [e.message] };
    console.error('[live] refresh failed:', e.message, '— showing bundled fixtures; will retry.');
  }
}
app.locals.getLastFetch = () => lastFetch;

if (dataMode === 'auto' || dataMode === 'demo') {
  console.log(`Data mode: AUTO — self-driving tournament (tick every ${SIM_INTERVAL}ms). Real fixtures, simulated live results.`);
  setInterval(() => { try { sim.tick(); } catch (e) { console.error(e.message); } }, SIM_INTERVAL);
} else if (dataMode === 'worldcup26' || dataMode === 'footballdata' || dataMode === 'espn') {
  console.log(`Data mode: LIVE via ${dataMode} (polling every ${REFRESH_INTERVAL}ms).`);
  refreshLive();
  setInterval(refreshLive, REFRESH_INTERVAL);
} else {
  console.log('Data mode: STATIC — real teams, groups & fixtures, no results (set DATA_SOURCE for live/auto).');
}

const server = app.listen(PORT, () => {
  console.log(`World Cup 2026 Tracker  →  http://localhost:${PORT}`);
});
// SSE requires long-lived connections — extend Node's default 5 s keep-alive.
// NGINX reverse proxy must also have proxy_read_timeout > this value.
server.keepAliveTimeout = 120000;   // 2 min
server.headersTimeout   = 125000;   // slightly above keepAliveTimeout

// graceful shutdown for container/EC2 restarts
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

module.exports = app;
