# 🏆 World Cup 2026 — Live Tracker

> A Node.js + Express web app: fixtures, participating teams, live matches, auto-updating group standings, and a knockout bracket that advances to a champion. Built as a **deployable DevOps project** with tests, Docker, and CI/CD to AWS EC2.

![Node](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)
![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Tests](https://img.shields.io/badge/tests-passing-2EA043?style=flat-square)

---

## ✨ Features

- **Real live data** — fixtures, scores, group tables, and the knockout bracket come straight from the keyless [worldcup26.ir](https://worldcup26.ir) API (all 48 teams, 104 matches, 16 stadiums).
- **Live matches** — in-progress games show the live score and minute; finished games show full-time results; upcoming games show kickoff time and venue.
- **Auto-updating standings** — group tables recompute from real results (3-1-0; GD, GF tiebreakers).
- **Knockout bracket** — Round of 32 → … → Final, filling in as teams advance (TBD slots show "Runner-up Group A" etc.).
- **Self-updating everywhere** — the server polls the API and pushes changes to the browser over SSE; works identically locally and on EC2.
- **REST API + diagnostics** — clean JSON endpoints, plus `/api/diagnostics` to see exactly what was fetched and matched.

> **Data sources (set `DATA_SOURCE`):**
> - *unset / `worldcup26`* — **default.** Real live tournament data from worldcup26.ir. Keyless, no setup.
> - `footballdata` + `FOOTBALL_API_KEY` — alternative live source ([football-data.org](https://www.football-data.org/), free key).
> - `espn` — alternative live source (keyless, best-effort).
> - `demo` — self-driving simulator that plays a whole tournament to a champion (offline showcase, **not real**).
> - `static` — real teams/groups/fixtures with no results (frozen).
>
> It never scrapes Google — that violates ToS and breaks constantly. A real sports API is the correct, stable source.

---

## 🚀 Run locally

```bash
npm install
npm start          # http://localhost:3000  — live worldcup26.ir data, no key needed
npm run dev        # auto-reload via nodemon
npm test           # unit + integration tests (node:test)
```



---

## 🔌 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Liveness probe |
| GET | `/api/state` | Phase, progress, champion |
| GET | `/api/teams` | All 48 teams |
| GET | `/api/standings` | Live group tables |
| GET | `/api/fixtures` | All matches (`?phase=`, `?status=`, `?group=`) |
| GET | `/api/live` | Matches in progress |
| GET | `/api/bracket` | Knockout rounds |
| POST | `/api/tick` | Advance one step (demo/CI) |
| POST | `/api/reset` | Restart the tournament |

---


## 📡 Data & providers

Real teams, groups, and fixtures are bundled in `src/data/seed.js` (the official draw). Live results are layered on top by a provider that returns normalized records; `src/engine/simulator.js → ingestLive()` matches them to the bundled fixtures by team name (with an alias map for variants like "United States"→"USA", "IR Iran"→"Iran", "Côte d'Ivoire", "Türkiye", "Cabo Verde"→"Cape Verde", "Congo DR"→"DR Congo").

- `src/providers/footballData.js` — football-data.org v4 (`/competitions/WC/matches`), clean stages/groups.
- `src/providers/espn.js` — ESPN public scoreboard, keyless best-effort.

The `FOOTBALL_API_KEY` is read from the environment — never commit it. In CI/CD, store it as a GitHub Actions secret and pass it through to the EC2 service (e.g., in the PM2 ecosystem env or a `.env` the deploy step writes).

> Group membership always comes from the verified bundled draw, so even if a provider's labels are messy, the groups stay correct; only scores/status are overlaid.


## 🗂️ Structure

```
wc2026-tracker/
├── server.js                 # Express entry + sim loop
├── ecosystem.config.js       # PM2
├── Dockerfile
├── src/
│   ├── data/seed.js          # sample 2026 dataset (48 teams, 12 groups)
│   ├── engine/standings.js   # group-table logic (tested)
│   ├── engine/bracket.js     # qualifiers + knockout (tested)
│   ├── engine/simulator.js   # auto-advance to a champion
│   ├── providers/footballData.js, espn.js, index.js
│   └── routes/api.js
├── public/                   # frontend (index.html, app.js, styles.css)
├── test/                     # node:test suites
└── .github/workflows/        # ci.yml, cd-ec2.yml
```

---

*Built by Md Ahnaf Shariar · a DevOps capstone tying together Git, CI/CD, Docker, PM2, NGINX, and AWS EC2.*


