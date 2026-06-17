'use strict';
/**
 * Provider selector. Two kinds of providers:
 *   - SNAPSHOT (worldcup26): returns the whole tournament; replaces state.
 *   - OVERLAY  (espn, footballdata): returns result records; overlaid on bundled fixtures.
 *
 *   DATA_SOURCE=worldcup26   -> worldcup26.ir  (RECOMMENDED, keyless, complete)  [snapshot]
 *   DATA_SOURCE=footballdata + FOOTBALL_API_KEY                                  [overlay]
 *   DATA_SOURCE=espn                                                             [overlay]
 *   DATA_SOURCE=demo         -> random simulator (offline)
 *   (unset)                  -> real bundled fixtures, no live scores
 */
const worldcup26 = require('./worldcup26');
const footballData = require('./footballData');
const espn = require('./espn');

function mode() {
  const m = (process.env.DATA_SOURCE || '').toLowerCase();
  if (!m) return 'worldcup26';            // default: real live data, keyless, zero setup
  if (m === 'worldcup26') return 'worldcup26';
  if (m === 'footballdata' && process.env.FOOTBALL_API_KEY) return 'footballdata';
  if (m === 'espn') return 'espn';
  if (m === 'demo' || m === 'auto') return 'demo';
  if (m === 'static') return 'static';
  return 'worldcup26';
}

function kind() {
  return mode() === 'worldcup26' ? 'snapshot'
    : (mode() === 'footballdata' || mode() === 'espn') ? 'overlay'
    : 'none';
}

// snapshot provider
async function fetchSnapshot() { return worldcup26.fetchSnapshot(); }

// overlay providers
async function fetchResults() {
  switch (mode()) {
    case 'footballdata': return footballData.fetchResults();
    case 'espn': return espn.fetchResults();
    default: return { records: [], errors: [] };
  }
}

module.exports = { mode, kind, fetchSnapshot, fetchResults };
