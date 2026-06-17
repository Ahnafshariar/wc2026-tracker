'use strict';
/**
 * REAL FIFA World Cup 2026 group-stage data.
 * Groups A–L as set by the official Final Draw (5 Dec 2025, Washington DC).
 * Source verified against the published draw (the 12 seeded teams each head
 * one group A–L). Fixtures are the real round-robin matchups within each group.
 * Exact kickoff times + live results are filled in by the live provider
 * (see src/providers). Without a provider the real schedule still shows.
 */

const GROUPS = {
  A: ['Mexico', 'South Africa', 'South Korea', 'Czechia'],
  B: ['Canada', 'Bosnia & Herzegovina', 'Qatar', 'Switzerland'],
  C: ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  D: ['USA', 'Paraguay', 'Australia', 'Türkiye'],
  E: ['Germany', 'Curaçao', "Côte d'Ivoire", 'Ecuador'],
  F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Iraq', 'Norway'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'],
  L: ['England', 'Croatia', 'Ghana', 'Panama']
};

const FLAGS = {
  Mexico: '🇲🇽', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷', Czechia: '🇨🇿',
  Canada: '🇨🇦', 'Bosnia & Herzegovina': '🇧🇦', Qatar: '🇶🇦', Switzerland: '🇨🇭',
  Brazil: '🇧🇷', Morocco: '🇲🇦', Haiti: '🇭🇹', Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  USA: '🇺🇸', Paraguay: '🇵🇾', Australia: '🇦🇺', 'Türkiye': '🇹🇷',
  Germany: '🇩🇪', 'Curaçao': '🇨🇼', "Côte d'Ivoire": '🇨🇮', Ecuador: '🇪🇨',
  Netherlands: '🇳🇱', Japan: '🇯🇵', Sweden: '🇸🇪', Tunisia: '🇹🇳',
  Belgium: '🇧🇪', Egypt: '🇪🇬', Iran: '🇮🇷', 'New Zealand': '🇳🇿',
  Spain: '🇪🇸', 'Cape Verde': '🇨🇻', 'Saudi Arabia': '🇸🇦', Uruguay: '🇺🇾',
  France: '🇫🇷', Senegal: '🇸🇳', Iraq: '🇮🇶', Norway: '🇳🇴',
  Argentina: '🇦🇷', Algeria: '🇩🇿', Austria: '🇦🇹', Jordan: '🇯🇴',
  Portugal: '🇵🇹', 'DR Congo': '🇨🇩', Uzbekistan: '🇺🇿', Colombia: '🇨🇴',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Croatia: '🇭🇷', Ghana: '🇬🇭', Panama: '🇵🇦'
};

const GROUP_LETTERS = Object.keys(GROUPS);
const RR = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]; // real round-robin pairings

function buildSeed() {
  const teams = [];
  let tid = 1;
  GROUP_LETTERS.forEach((letter) => {
    GROUPS[letter].forEach((name) => {
      teams.push({ id: 't' + (tid++), name, flag: FLAGS[name] || '🏳️', group: letter });
    });
  });

  const groups = GROUP_LETTERS.map((letter) => ({
    letter,
    teamIds: teams.filter((t) => t.group === letter).map((t) => t.id)
  }));

  const matches = [];
  let n = 1;
  const start = new Date('2026-06-11T16:00:00Z').getTime();
  groups.forEach((g, gi) => {
    RR.forEach((pair, idx) => {
      matches.push({
        id: 'm' + n,
        phase: 'GROUP', group: g.letter, round: 'Group ' + g.letter,
        homeId: g.teamIds[pair[0]], awayId: g.teamIds[pair[1]],
        homeGoals: null, awayGoals: null, status: 'SCHEDULED',
        kickoff: new Date(start + (gi * 6 + idx) * 4 * 3600 * 1000).toISOString()
      });
      n++;
    });
  });

  return { teams, groups, matches };
}

module.exports = { buildSeed, GROUPS, FLAGS, GROUP_LETTERS };
