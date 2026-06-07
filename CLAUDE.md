# Ella Edge EMS — Claude Code Project Specification

## Project Purpose

Ella Edge EMS is a **locally-operated Energy Management System** for Austrian multi-party residential buildings (*Mehrparteienwohnanlagen*) with shared PV systems and battery storage. It runs on a DIN-Rail PC in the building's control cabinet — no cloud dependency, no external services.

The core business problem: residents who join as **B+ participants** receive allocated locally-produced solar/battery energy at a lower tariff. Non-participants (**B-**) stay on the grid. The EMS handles real-time inverter control, 15-minute settlement intervals (Austrian regulatory requirement), billing data, and resident-facing reporting.

---

## Architecture

```
nginx (:80)
  ├── /           → frontend/dist   (React SPA, static)
  ├── /api/       → backend-api:3000  (Bun + Elysia, TypeScript)
  └── /sim/       → simulation:8080   (FastAPI, Python)

SQLite (WAL mode) ← shared by all services
  ├── backend-api     (reads + writes via bun:sqlite)
  ├── meter-collector     (Python, writes measurements + power_states)
  ├── inverter-controller (Python, reads power_states, writes control_decisions)
  ├── settlement-worker   (Python, writes settlement_intervals + allocations)
  ├── reporting-worker    (Python, reads all, writes PDF/CSV/ZIP to ./reports/)
  └── simulation          (Python/FastAPI, optional writes via /sim/push)
```

All services share one SQLite file at `./data/ella-edge.db` (volume-mounted into each container). WAL mode allows concurrent reads with single writer. All services set `PRAGMA journal_mode=WAL` and `busy_timeout`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Bun 1.2 + Elysia (TypeScript) |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 + Recharts |
| Python services | Python 3.12-slim, no external frameworks (except FastAPI for simulation) |
| Database | SQLite with WAL mode — shared between Bun and Python |
| PDF generation | fpdf2 2.8.x with DejaVu Unicode fonts (`fonts-dejavu-core`) |
| Container runtime | Docker Compose |
| Reverse proxy | nginx:stable-alpine |
| Simulation API | FastAPI + uvicorn |

---

## Repository Structure

```
ella_ems/
├── CLAUDE.md                  ← this file
├── docker-compose.yml         ← all services, volumes, profiles
├── .env                       ← secrets (gitignored); see .env.example pattern below
├── nginx/nginx.conf           ← reverse proxy, SPA fallback, /api/ + /sim/ proxy
├── database/
│   ├── schema.sql             ← SQLite schema (idempotent, CREATE IF NOT EXISTS)
│   └── seed/demo_seed.sql     ← demo data: 1 site, 6 apts, 4 B+/2 B-, tariffs, admin user
├── backend-api/               ← Bun + Elysia REST API
│   ├── Dockerfile             ← oven/bun:1.2-alpine, 3-stage (deps/runner)
│   └── src/
│       ├── main.ts            ← app entry, registers all routes
│       ├── db/init.ts         ← getDb() singleton, applies schema + seed on startup
│       └── routes/
│           ├── health.ts      ← GET /api/health
│           ├── auth.ts        ← POST /api/auth/login (stub — JWT not yet implemented)
│           ├── dashboard.ts   ← GET /api/dashboard/operator|resident/:id|devices
│           ├── meters.ts      ← GET /api/meters/status + /:id/latest
│           ├── participants.ts
│           ├── alarms.ts      ← GET/POST ack/close
│           ├── controlDecisions.ts
│           ├── settlement.ts  ← intervals, summary, plausibility, approve
│           └── reports.ts     ← generate, list, download
├── frontend/                  ← React SPA
│   ├── Dockerfile             ← node:22-alpine builder → dist; nginx runner (unused in compose)
│   ├── vite.config.ts         ← /api proxy → localhost:3000 for local dev
│   └── src/
│       ├── api/client.ts      ← all fetch calls — update here when adding API endpoints
│       ├── hooks/usePolling.ts ← generic polling hook used everywhere (5s default)
│       ├── components/
│       │   ├── Layout.tsx     ← nav bar (add new nav entries here)
│       │   └── StatusBadge.tsx
│       └── pages/
│           ├── DashboardOperator.tsx  ← main EMS overview + 30-min chart
│           ├── ResidentDashboard.tsx  ← B+ resident portal
│           ├── Participants.tsx
│           ├── Meters.tsx
│           ├── Devices.tsx
│           ├── Alarms.tsx
│           ├── Settlement.tsx  ← 15-min interval table + approve workflow
│           ├── Reports.tsx     ← report generation + download
│           ├── OpsRules.tsx
│           └── SimDashboard.tsx  ← interactive simulation (standalone, no EMS dependency)
├── services/
│   ├── meter-collector/       ← reads smart meters (or simulates), writes measurements
│   ├── inverter-controller/   ← reads power_states → calculates setpoint → control_decisions
│   ├── settlement-worker/     ← closes 15-min intervals, proportional B+ allocation
│   ├── reporting-worker/      ← polls reports table, generates PDF/CSV/ZIP
│   └── alarm-worker/          ← placeholder (alarm logic in backend-api for now)
├── simulation/                ← standalone simulation service (independent of core EMS)
│   ├── sim_api.py             ← FastAPI: /sim/state, /sim/update, /sim/push, /sim/reset
│   └── Dockerfile
├── config/                    ← JSON config files (mounted read-only into services)
│   ├── site.example.json
│   ├── inverter.example.json
│   └── tariffs.example.json
├── data/                      ← SQLite DB (gitignored except .gitkeep)
├── logs/                      ← service logs (gitignored)
├── reports/                   ← generated report files (gitignored except .gitkeep)
└── tools/
    ├── backfill_month.py      ← generate a full month of simulation data (idempotent)
    ├── check_db.py            ← quick DB health check (magic bytes, WAL size)
    └── repair_db.py           ← WAL checkpoint + table row count check
```

---

## Key Commands

### Start the system
```bash
docker compose up -d
```
Starts: nginx, backend-api, meter-collector, inverter-controller, settlement-worker, reporting-worker, simulation.

### Build and deploy frontend (required after any frontend change)
```bash
# 1. Rebuild the frontend image
docker compose build frontend

# 2. Copy built dist to host (nginx serves from ./frontend/dist directly)
docker run --rm -v "./frontend/dist:/output" ella_ems-frontend sh -c "cp -rp /app/dist/. /output/"

# 3. Reload nginx (no restart needed)
docker exec ella-nginx nginx -s reload
```

**Why this pattern:** The nginx container serves `./frontend/dist` as a bind mount. The `frontend` service in docker-compose (profile: `build`) copies the compiled assets from the image into the host directory. This decouples build from runtime.

### Rebuild a backend service
```bash
docker compose build backend-api   # or meter-collector, etc.
docker compose up -d --no-deps backend-api
```

### Rebuild simulation
```bash
docker compose build simulation
docker compose up -d simulation
```

### Generate test data for a full month
```bash
docker exec ella-reporting-worker python backfill_month.py 2026-05
```
Script is idempotent — safe to re-run. Generates measurements, power_states, control_decisions (5-min intervals), then settles all 15-min intervals.

### Local frontend development
```bash
cd frontend
npm install
npm run dev   # proxies /api/ to localhost:3000
```
Requires backend-api running locally or via Docker on port 3000.

### DB health check
```bash
python tools/check_db.py    # file size + magic bytes check
python tools/repair_db.py   # WAL checkpoint + row counts
```

---

## Environment Variables

The `.env` file (gitignored) controls runtime behaviour:

```env
ELLA_DB_PATH=/data/ella-edge.db
ELLA_CONFIG_DIR=/config
API_PORT=3000
JWT_SECRET=dev-secret-change-in-production
SIMULATION_MODE=true
SIMULATION_SCENARIO=summer_high_pv   # or winter_20_percent_local_coverage
LOG_LEVEL=info
```

All services use `ELLA_DB_PATH` to find the shared SQLite file. Default values are set in `docker-compose.yml` via `${VAR:-default}` syntax.

---

## Database

**File:** `./data/ella-edge.db` (WAL mode, shared by all services)

**Key tables and their writers:**

| Table | Written by | Purpose |
|-------|-----------|---------|
| `measurements` | meter-collector, simulation | Per-meter power readings every 5s |
| `power_states` | meter-collector, simulation | Aggregated B+/B- totals, PV, SOC |
| `control_decisions` | inverter-controller | Setpoint per 5s cycle |
| `settlement_intervals` | settlement-worker | 15-min energy totals + status |
| `settlement_participant_allocations` | settlement-worker | Per-participant energy split |
| `reports` | backend-api (creates), reporting-worker (completes) | Report job queue |
| `alarms` | any service | System alarms |
| `audit_events` | backend-api | User action log |

**Schema location:** `database/schema.sql` — applied idempotently on startup by `backend-api/src/db/init.ts`.

**Seed data location:** `database/seed/demo_seed.sql`
- Site: `site-demo-01` (Ella Demo Anlage, Wien)
- 6 apartments, 6 meters (`meter-01` … `meter-06`)
- 4 B+ participants (part-01..04), 2 B- (part-05..06)
- Default admin: `admin` / password hash is a placeholder (JWT auth not yet implemented)
- Tariff: local 8 ct/kWh, grid 28 ct/kWh, service fee 2 ct/kWh

**SQLite concurrency rules:**
- Always set `PRAGMA journal_mode=WAL` and `busy_timeout=5000` in every connection
- One write transaction at a time; reads are concurrent
- Never open a connection and hold it across a sleep loop — open, write, close each cycle
- If DB becomes corrupted (can happen under VirtioFS on Docker Desktop): delete `ella-edge.db`, `ella-edge.db-wal`, `ella-edge.db-shm` — the backend-api will recreate from schema+seed on next start, then re-run `backfill_month.py`

---

## Service Logic

### meter-collector
- Polls every 5s (configurable via `METER_POLL_INTERVAL_S`)
- In `SIMULATION_MODE`: generates deterministic per-meter loads using a hash-seeded random + time-of-day curve; PV via sine wave; SOC via sinusoidal daily cycle
- Writes one `measurements` row per active meter, then one `power_states` row with B+/B- aggregates
- `simulate_power(meter_id, scenario, t)` — deterministic from meter ID hash
- `simulate_pv(scenario, t)` — `summer_high_pv`: 5000W peak sine 6-20h; `winter`: 800W peak 8-16h

### inverter-controller
- Runs every 5s (configurable via `CONTROL_INTERVAL_S`)
- Reads latest `power_states` row; calculates setpoint = B+ total demand
- Limits: `MIN_SOC_PCT=15` (lock discharge below), `MAX_INVERTER_W=10000`, `HYSTERESIS_W=50` (skip write if no meaningful change)
- Writes `control_decisions` with reason codes: `OK_BPLUS_DEMAND_MATCHED`, `LIMITED_BY_BATTERY_SOC`, `LIMITED_BY_INVERTER_MAX`, `NO_VALID_BPLUS_DATA`, `FAILSAFE`

### settlement-worker
- Runs every 60s; closes all `OPEN` 15-min intervals that ended > 1 minute ago
- Proportional allocation: each B+ participant's share = their consumption / total B+ consumption × available local energy
- Plausibility checks: no over-allocation (>1% tolerance), no B- receiving local energy, no negative values; flags as `OK`/`WARNING`/`FAILED`
- Uses `UNIQUE(site_id, interval_start_utc)` constraint — idempotent on re-run

### reporting-worker
- Polls `reports` table for `PENDING` jobs every 10s
- Report types: `RESIDENT_MONTHLY` (PDF with cost breakdown, 15-min detail table), `OPERATOR_MONTHLY` (PDF), `CSV_DETAIL` (all allocations), `DIAGNOSTICS` (ZIP)
- PDF uses DejaVu Unicode fonts — requires `fonts-dejavu-core` apt package in Dockerfile
- Font paths: `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf` + `DejaVuSans-Bold.ttf`
- `params` JSON column on `reports` table stores generation options (e.g. `{"include_detail": true}`)
- Files written to `/reports/` container path (volume-mounted from `./reports/`)

### simulation (FastAPI)
- Standalone service — **EMS does not depend on it**
- In-memory state: `pv_kw`, `soc_pct`, 6 meter loads + B+ flags, `interval_s`
- Energy flow logic mirrors the real EMS: PV first → battery (if SOC > 20%) → grid fallback for B+ deficit
- **`POST /sim/push`**: writes current state directly into the EMS DB (`measurements` + `power_states`)
  - Meter mapping by index: sim m1→`meter-01`, m2→`meter-02`, … m6→`meter-06`
  - After push, the running `inverter-controller` reads the new `power_states` and automatically computes a `control_decision`
  - Push interval is max 2s to dominate the meter-collector (5s) when EMS sync is active
- **`GET /sim/db_status`**: checks DB accessibility from simulation container
- To use simulation as sole EMS input: `docker compose stop meter-collector inverter-controller`, then enable sync in SimDashboard

---

## Frontend Patterns

- All API calls go through `frontend/src/api/client.ts` — add new endpoints there
- `usePolling(fetcher, intervalMs)` hook for live data — default 5s poll
- Dark theme: `bg-gray-950` page, `bg-gray-900` cards, `border-gray-800` borders
- Status colors: green=OK/local, amber=warning/grid, red=error, blue=battery, gray=offline/B-
- Tailwind classes only — no CSS modules, no styled-components
- German UI labels throughout (Austrian German, formal "Sie" not used — functional labels)
- Add new pages: create `src/pages/Xyz.tsx`, add route in `App.tsx`, add nav entry in `Layout.tsx`

---

## API Reference

Base URL: `http://localhost/api/`  
Swagger UI: `http://localhost/api/docs`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Service health + DB connectivity |
| `/api/dashboard/operator` | GET | Power state, 30-min history, alarm count, today's settlement |
| `/api/dashboard/resident/:id` | GET | Per-participant today/month consumption + savings |
| `/api/dashboard/devices` | GET | Inverter + battery status, latest decision |
| `/api/meters/status` | GET | All meters with latest reading |
| `/api/alarms` | GET | All alarms (last 100) |
| `/api/alarms/active` | GET | Active alarms only |
| `/api/alarms/:id/ack` | POST | Acknowledge alarm |
| `/api/alarms/:id/close` | POST | Close alarm |
| `/api/control-decisions` | GET | `?limit=20` — recent decisions |
| `/api/control-decisions/latest` | GET | Single latest decision |
| `/api/settlement/intervals` | GET | `?month=2026-05` — all intervals |
| `/api/settlement/summary` | GET | `?month=2026-05` — aggregated monthly totals |
| `/api/settlement/plausibility` | GET | `?month=2026-05` — plausibility check results |
| `/api/settlement/approve` | POST | `{month: "2026-05"}` — lock month for billing |
| `/api/reports` | GET | All reports (last 100) |
| `/api/reports/generate` | POST | `{report_type, month, participant_id?, include_detail?}` |
| `/api/reports/:id/download` | GET | Stream file to browser |
| `/sim/state` | GET | Current simulation state + computed flow |
| `/sim/update` | POST | Update simulation parameters |
| `/sim/push` | POST | Write simulation state to EMS DB |
| `/sim/reset` | GET | Reset simulation to defaults |
| `/sim/db_status` | GET | Check if EMS DB is accessible from simulation container |

---

## Known Issues / Not Yet Implemented

- **JWT authentication**: `auth.ts` returns 501. All API endpoints are currently open — no token required. Planned: JWT with role-based access (admin, operator, resident, ops, solarel).
- **Real meter protocols**: Modbus TCP/RTU code paths are stubs. `protocol` field on meters table supports `SIMULATION | MODBUS_TCP | MODBUS_RTU` but only SIMULATION is implemented.
- **Alarm worker**: The `services/alarm-worker/` directory exists but has no implementation. Alarm creation is manual via API.
- **Settlement approval workflow**: `LOCKED` status exists but approval UI is minimal.
- **B+ status in simulation**: The "B+" toggle in SimDashboard only affects simulation-internal flow calculation. It does not update the `participants` table in the DB — the settlement and resident dashboard still use the DB participant status.

---

## Demo Login

URL: `http://localhost/`  
Current state: Auth not implemented — all pages accessible without login.  
Admin user in seed: username `admin`, password hash is a placeholder.

---

## Docker Compose Profiles

- Default (no profile): nginx, backend-api, meter-collector, inverter-controller, settlement-worker, reporting-worker, simulation
- `--profile build`: adds `frontend` builder container (copies dist to host)
- `--profile events`: adds `rabbitmq` (future event bus, not yet used)

---

## Development Notes

### Adding a new API route
1. Create `backend-api/src/routes/newFeature.ts` exporting an Elysia plugin with `prefix: '/api/new-feature'`
2. Import and `.use()` it in `backend-api/src/main.ts`
3. Add the call to `frontend/src/api/client.ts`
4. Rebuild: `docker compose build backend-api && docker compose up -d --no-deps backend-api`

### Adding a new frontend page
1. Create `frontend/src/pages/NewPage.tsx`
2. Add route in `frontend/src/App.tsx`
3. Add nav entry in `frontend/src/components/Layout.tsx`
4. Rebuild frontend and deploy (see Key Commands above)

### Python service changes
Each service has its own `Dockerfile` and `requirements.txt`. Rebuild:
```bash
docker compose build <service-name>
docker compose up -d --no-deps <service-name>
```

### SQLite on Docker Desktop (Windows)
Docker Desktop uses VirtioFS. Under heavy concurrent write load the WAL/SHM files can become inconsistent after abrupt container restarts. If the DB becomes unreadable:
```powershell
Remove-Item data\ella-edge.db, data\ella-edge.db-wal, data\ella-edge.db-shm -ErrorAction SilentlyContinue
docker compose restart backend-api   # recreates schema + seed
docker exec ella-reporting-worker python backfill_month.py 2026-05
```
