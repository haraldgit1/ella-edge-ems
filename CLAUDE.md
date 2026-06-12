# Ella Edge EMS — Claude Code Arbeitsanleitung

## Projektzweck

Ella Edge EMS ist ein **lokal betriebenes Energiemanagementsystem** für österreichische Mehrparteienwohnanlagen mit gemeinsamer PV-Anlage und Batteriespeicher. Das System läuft auf einem DIN-Rail-PC im Schaltschrank — ohne Cloud-Abhängigkeit.

Kernproblem: Bewohner, die als **B+** beitreten, beziehen zugeteilte lokal erzeugte Solar-/Batterieenergie zu einem günstigeren Tarif. Nicht-Teilnehmer (**B–**) bleiben am Netz. **H+** bezeichnet die Hausverwaltung (z. B. Wärmepumpe), die ebenfalls lokal versorgt wird.

Das System wird unter dem Sub-Pfad `/ella_ems/` betrieben (nicht `/`), damit es auf dem Produktionsserver neben bestehenden Services (ORDS, Oracle) koexistiert. Unter `/` liegt eine einfache Landing Page.

---

## Architektur

### URL-Routing (lokal und Produktion)

```
http://localhost/                     → Landing Page (nginx, statisch)
http://localhost/ella_ems/            → React SPA (frontend/dist, bind-mount)
http://localhost/ella_ems/api/        → backend-api:3000  (Prefix /ella_ems wird gestripped)
http://localhost/ella_ems/sim/        → simulation:8080   (Prefix /ella_ems wird gestripped)
http://localhost/ella_ems/smartmeter  → simulation:8080   (SmartMeter HW-Push)
```

### Container-Topologie

```
nginx (:80/:443)
  ├── /                     → /usr/share/nginx/landing  (nginx/html/)
  ├── /ella_ems/api/        → rewrite → backend-api:3000
  ├── /ella_ems/sim/        → rewrite → simulation:8080
  ├── /ella_ems/smartmeter  → rewrite → simulation:8080
  └── /ella_ems/            → alias   → /usr/share/nginx/ella_ems/  (frontend/dist)

SQLite (WAL mode) ← geteilt von allen Services
  ├── backend-api           (Bun, liest+schreibt)
  ├── meter-collector       (Python, schreibt measurements + power_states)  [Profil: collector]
  ├── inverter-controller   (Python, liest power_states, schreibt control_decisions)
  ├── settlement-worker     (Python, schreibt settlement_intervals + allocations)
  ├── reporting-worker      (Python, liest alles, schreibt PDFs/CSVs/ZIPs)
  └── simulation            (Python/FastAPI, schreibt via /sim/push und /smartmeter)
```

### Netzwerk-Topologie

**Lokal (Entwicklung):** Die `ella-nginx` übernimmt Routing. Alle Container im `ella_ems_default`-Netzwerk.

**Produktion (www.sailersoft.com):** Die `ella-nginx` läuft **nicht** (Profil `local_only`). Der bestehende sailersoft-nginx-Container übernimmt Routing. `backend-api` und `simulation` sind über das externe `webnet`-Netzwerk für den sailersoft-nginx erreichbar. Konfiguriert via `docker-compose.prod.yml`.

---

## Tech-Stack

| Layer | Technologie |
|-------|-------------|
| Backend API | Bun 1.2 + Elysia (TypeScript) |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 + Recharts |
| Python-Services | Python 3.12-slim, FastAPI (nur Simulation) |
| Datenbank | SQLite mit WAL-Modus, geteilt zwischen Bun und Python |
| PDF-Generierung | fpdf2 2.8.x mit DejaVu-Unicode-Fonts |
| Container | Docker Compose |
| Reverse Proxy | nginx:stable-alpine |
| Simulation API | FastAPI + uvicorn |

---

## Repository-Struktur

```
ella_ems/
├── CLAUDE.md                        ← diese Datei (Claude Code Anleitung)
├── docs/SPEC.md                     ← Projekt-Spezifikation (Business + Technik)
├── docker-compose.yml               ← Basis-Compose (alle Services)
├── docker-compose.prod.yml          ← Prod-Overlay: ella-nginx deaktiviert, webnet aktiviert
├── .env                             ← Secrets (gitignored)
├── nginx/
│   ├── nginx.conf                   ← Lokaler nginx (SPA alias, API-Proxy, Landing)
│   ├── html/index.html              ← Landing Page (Hello World)
│   └── sailersoft-location-blocks.conf  ← Referenz für Production-nginx-Config
├── database/
│   ├── schema.sql                   ← SQLite-Schema (idempotent, CREATE IF NOT EXISTS)
│   └── seed/demo_seed.sql           ← Demo-Daten: 1 Site, 7 Meter, 4 B+/2 B-/1 H+
├── backend-api/
│   └── src/
│       ├── main.ts                  ← App-Einstieg, registriert alle Routen
│       ├── db/init.ts               ← getDb() Singleton, Schema + Seed + Migrations
│       └── routes/                  ← Elysia-Plugins je Ressource
├── frontend/
│   ├── vite.config.ts               ← base: '/ella_ems/', Dev-Proxy
│   └── src/
│       ├── api/client.ts            ← ALLE fetch-Calls hier zentralisiert (BASE = '/ella_ems/api')
│       ├── utils/time.ts            ← UTC-Timestamp-Parsing + de-AT Formatierung
│       ├── hooks/usePolling.ts      ← Polling-Hook (Standard 5s)
│       ├── components/Layout.tsx    ← Navigationsleiste
│       └── pages/
│           ├── DashboardOperator.tsx
│           ├── SimDashboard.tsx     ← Software- UND Hardware-Simulation
│           └── ...
├── simulation/
│   ├── sim_api.py                   ← FastAPI: /sim/state, /sim/update, /sim/push, /sim/reset, /smartmeter
│   └── Dockerfile
├── services/
│   ├── meter-collector/             ← Profil: collector (startet nicht im Standard)
│   ├── inverter-controller/
│   ├── settlement-worker/
│   └── reporting-worker/
├── data/                            ← SQLite-DB (gitignored außer .gitkeep)
├── reports/                         ← Generierte Berichte (gitignored außer .gitkeep)
└── tools/
    ├── backfill_month.py
    ├── check_db.py
    └── repair_db.py
```

---

## Key Commands

### Lokal starten

```bash
docker compose up -d
```

Startet: ella-nginx, backend-api, inverter-controller, settlement-worker, reporting-worker, simulation.
**meter-collector startet nicht automatisch** (Profil `collector`) — das ist gewollt, damit Hardware-Push-Tests nicht gestört werden.

### Frontend neu bauen und deployen (lokal)

```bash
# 1. Image bauen
docker compose build frontend

# 2. Dist auf Host kopieren (absoluter Pfad — relative Pfade scheitern auf Windows/Git Bash)
docker run --rm -v "C:/dev2/ella_ems/frontend/dist:/output" ella_ems-frontend sh -c "cp -rp /app/dist/. /output/"

# 3. nginx neu laden (kein Neustart nötig)
MSYS_NO_PATHCONV=1 docker exec ella-nginx nginx -s reload
```

### Einzelnen Backend-Service neu bauen (lokal)

```bash
docker compose build backend-api
docker compose up -d --no-deps backend-api
```

### Simulation neu bauen (lokal)

```bash
docker compose build simulation
docker compose up -d --no-deps simulation
```

### meter-collector manuell starten (optional, lokal)

```bash
docker compose --profile collector up -d meter-collector
```

### Produktions-Deployment auf www.sailersoft.com

**WICHTIG:** Auf Prod immer BEIDE Compose-Files angeben, sonst fehlt das `webnet`-Netzwerk und der sailersoft-nginx findet die Container nicht (404/502).

```bash
# Auf dem Prod-Server (SSH: ella@www.sailersoft.com)
cd ~/app/ella_ems
git pull

# Service neu bauen und starten
docker compose -f docker-compose.yml -f docker-compose.prod.yml build <service>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps <service>

# Frontend bauen und deployen
docker compose -f docker-compose.yml -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --profile build frontend
# kein nginx-Reload nötig – bind mount, sofort sichtbar
```

### sailersoft-nginx auf Prod neu laden

```bash
docker exec nginx nginx -t && docker exec nginx nginx -s reload
```

### Testdaten für einen vollen Monat generieren

```bash
docker exec ella-reporting-worker python backfill_month.py 2026-05
```

Idempotent — sicher mehrfach ausführbar.

### DB-Diagnose

```bash
python tools/check_db.py    # Dateigröße + Magic-Bytes
python tools/repair_db.py   # WAL-Checkpoint + Zeilenzählung
```

### Lokale Frontend-Entwicklung (ohne Docker)

```bash
cd frontend
npm install
npm run dev   # Proxy: /ella_ems/api → localhost:3000, /ella_ems/sim → localhost:8080
```

Setzt laufende backend-api (Port 3000) und simulation (Port 8080) voraus.

---

## Umgebungsvariablen

`.env` (gitignored):

```env
ELLA_DB_PATH=/data/ella-edge.db
ELLA_CONFIG_DIR=/config
API_PORT=3000
JWT_SECRET=dev-secret-change-in-production
SIMULATION_MODE=true
SIMULATION_SCENARIO=summer_high_pv   # oder winter_20_percent_local_coverage
LOG_LEVEL=info
```

---

## Datenbank

**Datei:** `./data/ella-edge.db` (WAL-Modus, geteilt)

**Wichtige Tabellen:**

| Tabelle | Schreiber | Zweck |
|---------|-----------|-------|
| `measurements` | meter-collector, simulation | Leistungsmessung pro Zähler, alle 5s |
| `power_states` | meter-collector, simulation | Aggregierte B+/B-/PV/SOC-Totale |
| `control_decisions` | inverter-controller | Sollwert pro 5s-Zyklus |
| `settlement_intervals` | settlement-worker | 15-min-Energietotale + Status |
| `settlement_participant_allocations` | settlement-worker | Pro-Teilnehmer-Aufteilung |
| `meters` | Schema/Seed | Zähler inkl. `cid` (SmartMeter HW-ID) |
| `reports` | backend-api (erstellt), reporting-worker (abschließt) | Report-Jobqueue |
| `alarms` | alle Services | Systemalarme |

**Timestamp-Konvention:** Alle `*_utc`-Spalten speichern UTC als ISO-8601-String im Format `2026-06-12T18:47:26Z` (mit `T` und `Z`). SQLite-Funktion `datetime('now')` liefert ein Format mit Leerzeichen — für Zeitvergleiche immer `strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ...)` verwenden, sonst schlägt der String-Vergleich fehl.

**SQLite-Parallelitätsregeln:**
- Immer `PRAGMA journal_mode=WAL` und `busy_timeout=5000` setzen
- Verbindung nicht über Sleep-Loops hinweg halten — öffnen, schreiben, schließen
- DB Browser für SQLite sperrt die Datei → Docker-Container-Schreibzugriff blockiert

**DB-Neuanlage nach Korruption (VirtioFS / Docker Desktop Windows):**
```powershell
# Alle Container stoppen
docker compose down
# DB-Dateien löschen
Remove-Item data\ella-edge.db, data\ella-edge.db-wal, data\ella-edge.db-shm -ErrorAction SilentlyContinue
# DB durch Python-Container vorab anlegen (Bun kann unter VirtioFS keine neue Datei erstellen)
docker run --rm -v "C:/dev2/ella_ems/data:/data" python:3.12-slim python -c "import sqlite3; sqlite3.connect('/data/ella-edge.db').close()"
# System neu starten
docker compose up -d
docker exec ella-reporting-worker python backfill_month.py 2026-05
```

---

## Service-Logik

### meter-collector (Profil: `collector`)

- Startet **nicht** im Standard-`up` — nur explizit via `--profile collector`
- Polling alle 5s; im SIMULATION_MODE: deterministisch aus Meter-ID-Hash + Tageszeit-Kurve
- Schreibt eine `measurements`-Zeile pro aktivem Zähler, danach eine `power_states`-Zeile
- Wenn meter-collector läuft und gleichzeitig Hardware-Push aktiv ist, überschreiben sich die Werte gegenseitig

### inverter-controller

- Läuft alle 5s; liest neuestem `power_states`-Eintrag; Sollwert = B+-Gesamtbedarf
- Grenzen: `MIN_SOC_PCT=15`, `MAX_INVERTER_W=10000`, `HYSTERESIS_W=50`
- Reason-Codes: `OK_BPLUS_DEMAND_MATCHED`, `LIMITED_BY_BATTERY_SOC`, `LIMITED_BY_INVERTER_MAX`, `NO_VALID_BPLUS_DATA`, `FAILSAFE`

### settlement-worker

- Läuft alle 60s; schließt alle `OPEN` 15-min-Intervalle, die > 1 Minute zurückliegen
- Proportionale Allokation: Anteil B+ Teilnehmer = eigener Verbrauch / Gesamt-B+-Verbrauch × verfügbare Lokalenergie
- Plausibilitätsprüfung: keine Überzuteilung (>1% Toleranz), keine negativen Werte → `OK`/`WARNING`/`FAILED`

### reporting-worker

- Pollt `reports`-Tabelle alle 10s auf `PENDING`-Jobs
- Report-Typen: `RESIDENT_MONTHLY` (PDF), `OPERATOR_MONTHLY` (PDF), `CSV_DETAIL`, `DIAGNOSTICS` (ZIP)
- PDF-Font: DejaVu, benötigt `fonts-dejavu-core` im Dockerfile

### simulation (FastAPI, Port 8080)

- Eigenständiger Service — EMS hängt **nicht** von ihm ab
- In-Memory-State: `pv_kw`, `soc_pct`, 6 Bewohner-Zähler + H+, `interval_s`
- **`POST /sim/push`**: schreibt vollständigen Simulationszustand in EMS-DB
- **`POST /smartmeter`**: empfängt einzelne Zähler-Messwerte von Hardware; CID → meter_id Auflösung via DB; berechnet `power_states` aus allen Zählern der letzten 30s neu
- **`GET /sim/db_status`**: prüft DB-Erreichbarkeit aus Simulation-Container

---

## Frontend-Muster

### Sub-Pfad-Konfiguration

- `vite.config.ts`: `base: '/ella_ems/'` — alle Assets werden unter `/ella_ems/assets/...` gebaut
- `main.tsx`: `<BrowserRouter basename="/ella_ems">` — React Router kennt den Sub-Pfad
- `api/client.ts`: `const BASE = '/ella_ems/api'` — alle API-Calls automatisch korrekt
- Dev-Proxy in `vite.config.ts` stripped `/ella_ems` vor dem Weiterleiten an localhost

### Zeit-Utilities (`src/utils/time.ts`)

```typescript
import { utcToDate, fmtLocalTime, fmtLocalDateTime } from '../utils/time'
```

- `utcToDate(ts)` — parst UTC-Strings korrekt (normalisiert fehlendes `Z`)
- `fmtLocalTime(ts)` — `HH:MM:SS` in de-AT Lokalzeit
- `fmtLocalDateTime(ts)` — vollständiges Datum+Zeit in de-AT Lokalzeit
- **Niemals** rohe Strings slicen (`ts.substring(11, 19)`) — immer diese Utilities verwenden

### Dark-Theme-Konventionen

- Seite: `bg-gray-950`, Karten: `bg-gray-900`, Rahmen: `border-gray-800`
- Farben: grün = OK/lokal, amber = Warnung/Netz, rot = Fehler, blau = Batterie, grau = offline/B–, teal = H+
- Nur Tailwind-Klassen — kein CSS-Modul, kein styled-components
- Deutsche UI-Labels durchgängig

### API-Calls erweitern

1. Neuen Call in `frontend/src/api/client.ts` hinzufügen
2. Page/Hook implementieren
3. Neuer Endpunkt? → `backend-api/src/routes/` + `main.ts`

---

## API-Referenz

Swagger: `http://localhost/ella_ems/api/docs`

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/ella_ems/api/health` | GET | Health + DB-Konnektivität |
| `/ella_ems/api/dashboard/operator` | GET | Power state, 30-min-History, Alarme, Settlement |
| `/ella_ems/api/dashboard/resident/:id` | GET | Pro-Teilnehmer heute/Monat |
| `/ella_ems/api/dashboard/devices` | GET | Wechselrichter + Batterie, letzte Entscheidung |
| `/ella_ems/api/meters/status` | GET | Alle Zähler mit letztem Messwert |
| `/ella_ems/api/alarms` | GET | Alle Alarme (letzte 100) |
| `/ella_ems/api/alarms/active` | GET | Nur aktive Alarme |
| `/ella_ems/api/alarms/:id/ack` | POST | Alarm quittieren |
| `/ella_ems/api/alarms/:id/close` | POST | Alarm schließen |
| `/ella_ems/api/control-decisions` | GET | `?limit=20` — letzte Entscheidungen |
| `/ella_ems/api/control-decisions/latest` | GET | Letzte Einzelentscheidung |
| `/ella_ems/api/settlement/intervals` | GET | `?month=2026-05` — alle Intervalle |
| `/ella_ems/api/settlement/summary` | GET | `?month=2026-05` — Monatstotale |
| `/ella_ems/api/settlement/plausibility` | GET | `?month=2026-05` — Plausibilitätsprüfung |
| `/ella_ems/api/settlement/approve` | POST | `{month}` — Monat für Abrechnung sperren |
| `/ella_ems/api/reports` | GET | Alle Reports |
| `/ella_ems/api/reports/generate` | POST | `{report_type, month, participant_id?, include_detail?}` |
| `/ella_ems/api/reports/:id/download` | GET | Datei streamen |
| `/ella_ems/sim/state` | GET | Aktueller Simulationszustand + berechneter Fluss |
| `/ella_ems/sim/update` | POST | Simulationsparameter aktualisieren |
| `/ella_ems/sim/push` | POST | Simulationszustand in EMS-DB schreiben |
| `/ella_ems/sim/reset` | GET | Simulation auf Defaultwerte zurücksetzen |
| `/ella_ems/sim/db_status` | GET | DB-Erreichbarkeit aus Simulation-Container |
| `/ella_ems/smartmeter` | POST | SmartMeter HW-Push: `{LDT, LDTsm, CID, Pact}` |

---

## Docker Compose Profile

| Profil | Aktivierte Services |
|--------|---------------------|
| (kein) | ella-nginx, backend-api, inverter-controller, settlement-worker, reporting-worker, simulation |
| `collector` | + meter-collector |
| `build` | + frontend-builder (kopiert dist auf Host) |
| `local_only` | + ella-nginx (normalerweise schon im Standard) |
| `events` | + rabbitmq (zukünftige Event-Bus, noch nicht genutzt) |

Im Produktions-Overlay (`docker-compose.prod.yml`) wird `ella-nginx` auf Profil `local_only` gesetzt und startet damit **nicht** automatisch.

---

## Entwicklungshinweise

### Neue API-Route hinzufügen

1. `backend-api/src/routes/newFeature.ts` anlegen — Elysia-Plugin mit `prefix: '/api/new-feature'`
2. In `backend-api/src/main.ts` importieren und `.use()` aufrufen
3. In `frontend/src/api/client.ts` eintragen
4. `docker compose build backend-api && docker compose up -d --no-deps backend-api`

### Neue Frontend-Seite hinzufügen

1. `frontend/src/pages/NewPage.tsx` anlegen
2. Route in `frontend/src/App.tsx` eintragen
3. Nav-Eintrag in `frontend/src/components/Layout.tsx`
4. Frontend neu bauen und deployen (siehe Key Commands)

### DB-Migration (neue Spalte)

`backend-api/src/db/init.ts` enthält einen Migration-Block. Muster:

```typescript
try {
  db.run('ALTER TABLE meters ADD COLUMN new_col TEXT')
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_table_col ON table(col) WHERE col IS NOT NULL')
} catch { /* already exists */ }
```

`ALTER TABLE ... ADD COLUMN` unterstützt kein `UNIQUE` direkt — immer separat als `CREATE UNIQUE INDEX`.

### Python-Service ändern

```bash
docker compose build <service-name>
docker compose up -d --no-deps <service-name>
```

### MSYS_NO_PATHCONV auf Windows/Git Bash

Docker-Exec-Befehle mit absoluten Pfaden im Container scheitern in Git Bash (Pfadkonversion):

```bash
# Falsch (Git Bash konvertiert /var/log → C:/Program Files/Git/var/log):
docker exec ella-nginx cat /var/log/nginx/error.log

# Richtig:
MSYS_NO_PATHCONV=1 docker exec ella-nginx cat /var/log/nginx/error.log
```

---

## Bekannte Probleme / Nicht implementiert

- **JWT-Authentifizierung**: `auth.ts` gibt 501 zurück. Alle Endpunkte sind derzeit offen. Geplant: JWT mit Rollen (admin, operator, resident, ops, solarel).
- **Echte Zählerprotokolle**: Modbus TCP/RTU ist Stub. `protocol`-Feld unterstützt `SIMULATION | MODBUS_TCP | MODBUS_RTU`, aber nur SIMULATION ist implementiert.
- **Alarm-Worker**: `services/alarm-worker/` existiert, ist aber nicht implementiert.
- **B+-Status in Simulation**: Der B+-Toggle im SimDashboard betrifft nur die interne Flussberechnung. Er schreibt **nicht** in die `participants`-Tabelle — Settlement und Bewohner-Dashboard nutzen weiterhin den DB-Status.
- **Settlement-Freigabe-UI**: `LOCKED`-Status existiert, aber die Genehmigungsmaske ist minimal.
