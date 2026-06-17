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

Use an alternative source:

```bash
DATA_SOURCE=footballdata FOOTBALL_API_KEY=your_key npm start
DATA_SOURCE=espn npm start
DATA_SOURCE=demo npm start          # offline simulator
```

Tune with `REFRESH_INTERVAL` (live poll ms, default 30000) and `SIM_INTERVAL` (demo tick ms).

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

## 🐳 Docker

```bash
docker build -t wc2026-tracker .
docker run -p 3000:3000 wc2026-tracker
```

Runs as a non-root user with a built-in `HEALTHCHECK`.

---

## 🔁 CI/CD (GitHub Actions → EC2)

**CI** (`.github/workflows/ci.yml`): on every push/PR — installs deps, runs tests on Node 18 & 20, smoke-tests the server, and builds the Docker image.

**CD** (`.github/workflows/cd-ec2.yml`): after CI passes on `main`, deploys to EC2. Set these repo secrets (Settings → Secrets and variables → Actions):

- `EC2_HOST` — instance public IP/DNS
- `EC2_USER` — e.g. `ubuntu`
- `EC2_SSH_KEY` — the private deploy key (**never commit it**)

The CD file also documents the more secure **OIDC + SSM** alternative (no long-lived SSH key), matching the no-SSH pattern from the AWS VPC project.

### Manual EC2 deploy (first time)
```bash
# on the EC2 instance
sudo apt update && sudo apt install -y nodejs npm
sudo npm install -g pm2
git clone https://github.com/Ahnafshariar/wc2026-tracker.git
cd wc2026-tracker
npm ci --omit=dev
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```
Put NGINX in front (port 80 → 3000) using the reverse-proxy config from the AWS EC2 project, and open port 80 in the security group.

---

## 📡 Data & providers

Real teams, groups, and fixtures are bundled in `src/data/seed.js` (the official draw). Live results are layered on top by a provider that returns normalized records; `src/engine/simulator.js → ingestLive()` matches them to the bundled fixtures by team name (with an alias map for variants like "United States"→"USA", "IR Iran"→"Iran", "Côte d'Ivoire", "Türkiye", "Cabo Verde"→"Cape Verde", "Congo DR"→"DR Congo").

- `src/providers/footballData.js` — football-data.org v4 (`/competitions/WC/matches`), clean stages/groups.
- `src/providers/espn.js` — ESPN public scoreboard, keyless best-effort.

The `FOOTBALL_API_KEY` is read from the environment — never commit it. In CI/CD, store it as a GitHub Actions secret and pass it through to the EC2 service (e.g., in the PM2 ecosystem env or a `.env` the deploy step writes).

> Group membership always comes from the verified bundled draw, so even if a provider's labels are messy, the groups stay correct; only scores/status are overlaid.

### 🔑 Secret flow: `secret → CI → EC2`

1. **Local:** copy `.env.example` to `.env`, add your key. `.env` is gitignored — never committed.
2. **GitHub:** store the key as repo secret `FOOTBALL_API_KEY` (Settings → Secrets and variables → Actions), alongside `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.
3. **CD (`.github/workflows/cd-ec2.yml`):** after CI passes, the deploy step passes the secret into the EC2 shell (`envs: FOOTBALL_API_KEY`) and writes a locked-down `.env` (`chmod 600`) on the server, then `pm2 ... --update-env`. The key never lands in the repo or the build logs.

CI itself needs no key — tests run on bundled/demo data.

---

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

---

## 🩺 Troubleshooting: "not all matches are showing"

If live mode isn't reflecting every match, hit the diagnostics endpoint:

```bash
curl http://localhost:3000/api/diagnostics
```

It returns:

```json
{
  "mode": "espn",
  "lastFetch": "2026-06-13T...",
  "fetched": 48,        // matches the provider returned
  "matched": 46,        // matches successfully placed
  "skipped": 2,         // matches dropped
  "unmatchedTeamNames": ["Some Name", "Another"],
  "fetchErrors": []
}
```

- **`skipped > 0` with names in `unmatchedTeamNames`** → the provider spells a country differently than the app. Add the spelling to the `ALIAS` map in `src/engine/simulator.js` (e.g., `'cote divoire': "Côte d'Ivoire"`). The app already handles the common variants (United States, Ivory Coast, Turkey, Korea Republic, IR Iran, Cabo Verde, Congo DR, Bosnia and Herzegovina, Curaçao, Czechia…).
- **`fetched` is low or `fetchErrors` is non-empty** → the provider call is failing or rate-limiting. Prefer **football-data.org** (`DATA_SOURCE=footballdata` + key): one request returns every match with clean stages/groups, far more reliable than ESPN's day-by-day scoreboard.
- **Everything 0 in `static` mode** → no `DATA_SOURCE` set, so there are no live results. Set `DATA_SOURCE=espn` (keyless) or `footballdata`.

The **Fixtures** tab always lists every match with its status (Soon / LIVE / FT); the **Live** tab shows in-progress games plus the latest results.

---

## 🚢 Deploy on EC2 (quick reference)

```bash
# on the instance
sudo apt update && sudo apt install -y nodejs npm
sudo npm install -g pm2
git clone https://github.com/Ahnafshariar/wc2026-tracker.git
cd wc2026-tracker
npm ci                                  # IMPORTANT: installs deps incl. dotenv
pm2 start ecosystem.config.js           # fork mode, single instance (see note)
pm2 save && pm2 startup
```

Put NGINX in front (port 80 → 3000) using `nginx/reverse-proxy-sse.conf` so Server-Sent Events stream correctly, then open port 80 in the security group.

**Run as a single instance.** This app holds tournament state in memory and pushes updates over SSE, so it must run in PM2 **fork mode with `instances: 1`** (the shipped `ecosystem.config.js` does this). Cluster mode would give each worker its own state and break SSE.

**If you hit `EADDRINUSE :3000`** something already holds the port:
```bash
pm2 kill
sudo fuser -k 3000/tcp           # free the port
pm2 start ecosystem.config.js
```
# wc2026-tracker
