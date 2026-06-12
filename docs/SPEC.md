# Ella Edge EMS — Projekt-Spezifikation

**Version:** 1.0  
**Stand:** Juni 2026  
**Betreiber:** Sailer Engineering  
**Zielplattform:** Ubuntu-Server, www.sailersoft.com/ella_ems

---

## Inhaltsverzeichnis

1. [Fachlicher Kontext](#1-fachlicher-kontext)
2. [Systemarchitektur](#2-systemarchitektur)
3. [Core EMS](#3-core-ems)
4. [Software-Simulation](#4-software-simulation)
5. [Hardware-Simulation](#5-hardware-simulation)
6. [Datenmodell](#6-datenmodell)
7. [API-Referenz](#7-api-referenz)
8. [Deployment-Topologie](#8-deployment-topologie)
9. [Bekannte Einschränkungen & Roadmap](#9-bekannte-einschränkungen--roadmap)

---

## 1. Fachlicher Kontext

### 1.1 Energiegemeinschaft (Erneuerbare-Energie-Gemeinschaft)

Ella Edge EMS verwaltet eine **Erneuerbare-Energie-Gemeinschaft (EEG)** nach österreichischem Recht in einem Mehrparteienwohnhaus. Das Haus verfügt über eine gemeinsame Photovoltaikanlage auf dem Dach sowie einen zentralen Batteriespeicher.

Der gesetzliche Rahmen (ElWOG, EAG) erlaubt es, selbst erzeugten Strom innerhalb der Gemeinschaft zu bevorzugtem Tarif zuzuteilen. Das EMS übernimmt:

- Echtzeit-Messung aller Verbrauchsstellen und der PV-Einspeisung
- Steuerung des Wechselrichters (Entlade-Sollwert)
- 15-Minuten-Abrechnung gemäß österreichischer Regulatorik
- Bewohnerportal und Betreiber-Berichte

### 1.2 Teilnehmertypen

| Typ | Bezeichnung | Beschreibung |
|-----|-------------|--------------|
| **B+** | B-Plus-Teilnehmer | Bewohner, die der EEG beigetreten sind. Erhalten lokal erzeugten Strom zum Lokaltarif (8 ct/kWh). Bei Unterdeckung wird Netz zugekauft (28 ct/kWh). |
| **B–** | B-Minus-Teilnehmer | Bewohner außerhalb der EEG. Beziehen ausschließlich Netzstrom. Das EMS misst ihren Verbrauch, beliefert sie aber nicht lokal. |
| **H+** | Hausverwaltung Plus | Die Hausverwaltung als B+-ähnlicher Teilnehmer für Gemeinschaftseinrichtungen (Wärmepumpe, Aufzug, Allgemeinstrom). Wird proportional mit Lokalenergie versorgt. |

### 1.3 15-Minuten-Abrechnungsintervall

Die österreichische Regulatorik schreibt vor, Energie in 15-Minuten-Intervallen zuzuteilen. Der `settlement-worker` schließt jedes Intervall nach dessen Ablauf:

1. Gesamtverbrauch aller B+/H+-Teilnehmer im Intervall (Wh)
2. Verfügbare Lokalenergie im Intervall (PV + Batterie-Entladung, Wh)
3. Proportionale Aufteilung: `Anteil_i = Verbrauch_i / Gesamt_Verbrauch × Lokalenergie`
4. Restlicher Bedarf = Netzbezug

Plausibilitätsprüfung stellt sicher, dass keine Über-Allokation (>1%-Toleranz), keine negativen Werte und keine B–-Zuteilung von Lokalenergie entstehen.

### 1.4 Tarife (Demo)

| Tarif | Wert |
|-------|------|
| Lokal (B+) | 8,0 ct/kWh |
| Netz | 28,0 ct/kWh |
| Service-Fee | 2,0 ct/kWh |

---

## 2. Systemarchitektur

### 2.1 Container-Übersicht

```
┌──────────────────────────────────────────────────────────────────┐
│  nginx (Port 80/443)                                              │
│  ├─ /                    → Landing Page (statisch, nginx/html/)  │
│  ├─ /ella_ems/           → React SPA (frontend/dist, bind-mount) │
│  ├─ /ella_ems/api/       → backend-api:3000 (Prefix gestripped)  │
│  ├─ /ella_ems/sim/       → simulation:8080  (Prefix gestripped)  │
│  └─ /ella_ems/smartmeter → simulation:8080  (HW-Push Receiver)   │
└──────────────────────────────────────────────────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────┐         ┌──────────────────┐
│  backend-api    │         │  simulation      │
│  Bun + Elysia   │         │  FastAPI/Python  │
│  :3000          │         │  :8080           │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         └──────────┬────────────────┘
                    ▼
         ┌─────────────────────┐
         │  SQLite (WAL)       │
         │  data/ella-edge.db  │
         └──────┬──────────────┘
                │
    ┌───────────┼───────────────┐
    ▼           ▼               ▼
meter-   inverter-      settlement-   reporting-
collector controller    worker        worker
(optional) (Sollwert)  (15-min)      (PDF/CSV)
```

### 2.2 Gemeinsame SQLite-Datenbank

Alle Services teilen eine SQLite-Datei unter `./data/ella-edge.db`. Sie ist im WAL-Modus betrieben, was parallele Lesezugriffe bei einem gleichzeitigen Schreiber erlaubt.

**Wichtig:** SQLite ist kein Postgres. Folgende Regeln sind zwingend:
- Jeder Service setzt `PRAGMA journal_mode=WAL` und `PRAGMA busy_timeout=5000` bei jeder neuen Verbindung
- Verbindungen werden nicht über Sleep-Loops hinweg offen gehalten
- Auf Docker Desktop / Windows (VirtioFS): Bei Korruption (passiert selten nach hartem Abbruch) alle drei DB-Dateien löschen (`ella-edge.db`, `ella-edge.db-wal`, `ella-edge.db-shm`). Bun kann unter VirtioFS keine neue Datei anlegen — zuerst per Python-Container anlegen.
- DB Browser für SQLite niemals öffnen, während Docker-Container laufen — er sperrt die Datei exklusiv.

### 2.3 Sub-Pfad-Routing (`/ella_ems/`)

Das System läuft unter `/ella_ems/` (nicht `/`), um auf dem Produktionsserver neben bestehenden Services (Oracle ORDS, sailersoft.com) zu koexistieren.

**Frontend-Build:** Vite wird mit `base: '/ella_ems/'` konfiguriert → alle Asset-Pfade werden `/ella_ems/assets/...`. Der React Router verwendet `basename="/ella_ems"`.

**nginx-Rewriting:** Der nginx striped den `/ella_ems`-Prefix für API und Simulation:
```nginx
location /ella_ems/api/ {
    rewrite ^/ella_ems(/api/.*)$ $1 break;
    proxy_pass http://backend-api:3000;
}
```

Der Backend-API und der Simulation API kennen selbst kein `/ella_ems/` — sie empfangen Requests als `/api/...` bzw. `/sim/...`.

---

## 3. Core EMS

### 3.1 meter-collector

**Zweck:** Liest alle aktiven Zähler und schreibt Messwerte in die Datenbank.

**Betriebsmodus:** Startet in `SIMULATION_MODE=true` → generiert deterministische Lastkurven pro Zähler-ID (Hash-basiert + Tageszeit-Sinuskurve). Im realen Betrieb würde hier Modbus TCP/RTU implementiert werden.

**Zyklus (alle 5s):**
1. Pro aktivem Zähler: Leistungswert lesen (oder simulieren)
2. `measurements`-Zeile einfügen (`source='SIMULATION'` oder `'MODBUS'`)
3. Alle Messwerte aggregieren → eine `power_states`-Zeile einfügen

**Szenarios (Simulation):**
- `summer_high_pv`: PV-Peak 5000W, Sinuskurve 6–20 Uhr
- `winter_20_percent_local_coverage`: PV-Peak 800W, Sinuskurve 8–16 Uhr

**Profil:** `collector` — startet **nicht** automatisch mit `docker compose up`. Explizit starten: `docker compose --profile collector up -d meter-collector`. Dies ist gewollt, um Hardware-Push-Tests nicht zu stören.

### 3.2 inverter-controller

**Zweck:** Liest den aktuellen Energiezustand und setzt einen Entlade-Sollwert am Wechselrichter.

**Zyklus (alle 5s):**
1. Neueste `power_states`-Zeile lesen
2. Sollwert berechnen = B+-Gesamtbedarf (Watt)
3. Grenzen prüfen: SOC < 15% → kein Entladen; Wechselrichter-Maximum = 10.000W
4. Hysterese: Kein Schreiben, wenn Änderung < 50W
5. `control_decisions`-Zeile einfügen

**Reason-Codes:**

| Code | Bedeutung |
|------|-----------|
| `OK_BPLUS_DEMAND_MATCHED` | Normalbetrieb |
| `LIMITED_BY_BATTERY_SOC` | SOC < Minimum → Entladen gesperrt |
| `LIMITED_BY_INVERTER_MAX` | Bedarf überschreitet Wechselrichter-Maximum |
| `NO_VALID_BPLUS_DATA` | Kein aktueller `power_states`-Eintrag |
| `FAILSAFE` | Sicherheitsmodus (Exception im Controller) |

### 3.3 settlement-worker

**Zweck:** Berechnet die 15-Minuten-Energieabrechnung für alle B+/H+-Teilnehmer.

**Zyklus (alle 60s):**
1. Alle `OPEN`-Intervalle finden, die > 1 Minute zurückliegen
2. Für jedes Intervall: `power_states`-Daten aggregieren → Energietotale (Wh)
3. Proportionale Allokation pro Teilnehmer berechnen
4. Plausibilität prüfen (kein Over-Allocation, keine negativen Werte)
5. Status setzen: `CALCULATED` (OK), `WARNING` (Grenzfall), `FAILED` (Plausibilitätsfehler)

**Idempotenz:** `UNIQUE(site_id, interval_start_utc)` — mehrfaches Ausführen für dasselbe Intervall ist sicher.

### 3.4 reporting-worker

**Zweck:** Generiert Berichte auf Anfrage als PDF, CSV oder ZIP.

**Pollt** `reports`-Tabelle alle 10s auf `PENDING`-Jobs.

**Report-Typen:**

| Typ | Format | Inhalt |
|-----|--------|--------|
| `RESIDENT_MONTHLY` | PDF | Kostenübersicht + 15-min-Detailtabelle für einen Bewohner |
| `OPERATOR_MONTHLY` | PDF | Anlagenzusammenfassung für Betreiber |
| `CSV_DETAIL` | CSV | Alle Allokationen des Monats als Tabelle |
| `DIAGNOSTICS` | ZIP | DB-Snapshot + Logdateien |

PDF-Generierung mit fpdf2 + DejaVu-Unicode-Fonts (erfordert `fonts-dejavu-core` im Dockerfile).

### 3.5 backend-api (Bun + Elysia)

**Zweck:** REST-API für das Frontend. Liest hauptsächlich; schreibt für Reports, Alarm-Acknowledgement und Settlement-Freigabe.

**Einstieg:** `backend-api/src/main.ts` — registriert alle Elysia-Plugins (je eine Datei pro Ressource).

**DB-Init:** `backend-api/src/db/init.ts` — `getDb()` Singleton. Beim ersten Aufruf:
1. Schema aus `database/schema.sql` ausführen (idempotent)
2. Seed aus `database/seed/demo_seed.sql` ausführen (`INSERT OR IGNORE`)
3. Migrations-Block ausführen (z. B. `ALTER TABLE meters ADD COLUMN cid TEXT`)

**Swagger:** `http://localhost/ella_ems/api/docs`

### 3.6 Frontend (React SPA)

**Tech:** React 18, Vite 5, Tailwind CSS 3, Recharts

**Seiten:**

| Seite | Beschreibung |
|-------|--------------|
| `DashboardOperator` | Live-Übersicht: PV, B+, Batterie-SOC, Leistungsverlauf-Chart (konfigurierbarer Zeitraum) |
| `ResidentDashboard` | Bewohnerportal: Tages- und Monatsverbrauch, Einsparungen |
| `Meters` | Zähler-Status mit letztem Messwert |
| `Participants` | Teilnehmerverwaltung (B+/B–) |
| `Devices` | Wechselrichter + Batterie, letzte Regelentscheidung |
| `Alarms` | Alarm-Liste mit Quittier-/Schließen-Funktion |
| `OpsRules` | Regelentscheidungs-History + Detailansicht |
| `Settlement` | 15-min-Intervalle, Monatsübersicht, Plausibilitätsprüfung, Freigabe |
| `Reports` | Berichts-Generierung und Download |
| `SimDashboard` | Interaktive Simulation (SW + HW, eigenständig) |

**Globale Muster:**
- Alle API-Calls in `api/client.ts` zentralisiert
- `usePolling(fetcher, intervalMs)` für Live-Daten (Standard: 5s)
- UTC→Lokalzeit immer über `utils/time.ts` (nie rohe String-Operationen)
- Dark-Theme: `bg-gray-950` Seite, `bg-gray-900` Karten

---

## 4. Software-Simulation

### 4.1 Zweck und Abgrenzung

Die Software-Simulation ist ein **eigenständiges Werkzeug** für Demo, Test und Entwicklung. Das Core EMS hängt **nicht** von ihr ab — sie schreibt optional in die EMS-Datenbank, ist aber in keiner Weise notwendig für den EMS-Betrieb.

Anwendungsfälle:
- Demonstration der Anlage ohne reale Hardware
- Test der EMS-Logik mit kontrollierten Eingaben
- Entwicklung und Review von Frontend-Features
- Schulung von Betreibern und Bewohnern

### 4.2 SimDashboard (Frontend, `SimDashboard.tsx`)

Das SimDashboard ist vollständig im Browser-State verwaltet — kein Backend-State außer dem optionalen EMS-DB-Push.

**Eingabeparameter:**

| Parameter | Bereich | Beschreibung |
|-----------|---------|--------------|
| PV-Leistung | 0–20 kW | Schieber, Echtzeit |
| Batterie-SOC | 0–100 % | Startwert; evolviert automatisch |
| Grundlast je Zähler | 0–4 kW | Schieber, Echtzeit |
| Klimaanlage (B+) | an/aus | +1 kW pro Wohnung |
| Wallbox (B+) | an/aus | +11 kW pro Wohnung (E-Auto) |
| H+ Wärmepumpe | 0–6 WE | 1,5 kW pro Wohneinheit |
| Animations-Intervall | 1/2/3/5s | Takt für SOC-Evolution und EMS-Push |

**B+-Toggle:** Schaltet einzelne Zähler zwischen B+ und B–. Betrifft nur die interne Flussberechnung — **nicht** die EMS-Datenbank.

**Energiefluss-Diagramm (SVG):** Zeigt animierte Fluss-Pfeile zwischen PV, Batterie, Netz, EMS, B+-Lokal, B+-Netz, B– und H+. Pfeilstärke skaliert mit der Leistung, Animationsgeschwindigkeit mit Fluss-Intensität.

### 4.3 Energie-Fluss-Algorithmus

Gleicher Algorithmus im Frontend (`computeFlow()`) und im Backend (`sim_api.py::compute_flow()`):

```
PV ≥ B+-Bedarf:
  PV → B+ (komplett lokal gedeckt)
  Überschuss → Batterie laden (max. 5 kW, nur wenn SOC < 100%)
  Rest-Überschuss → Netz-Export

PV < B+-Bedarf:
  PV → B+ (anteilig)
  Defizit → Batterie entladen (max. 5 kW, nur wenn SOC > 20%)
  Rest-Defizit → Netz-Zukauf für B+

B–-Verbrauch: immer 100% Netz (kein lokaler Anteil)
H+-Verbrauch: wird zu B+ addiert (gleiche Priorität wie B+-Bewohner)
```

**SOC-Evolution (Frontend, linear pro Tick):**
```
ΔWh = (Ladeleistung − Entladeleistung) × Intervall_s / 3600
ΔSOC = ΔWh / Kapazität_Wh × 100
```

Simulierte Batteriekapazität: 500 Wh (Demonstrationswert für sichtbare SOC-Änderung).

### 4.4 EMS-Synchronisation (`POST /sim/push`)

**Aktivierung:** „EMS synchronisieren"-Toggle im SimDashboard. Nur verfügbar wenn `db_status.available = true`.

**Was passiert:**
1. Frontend sendet aktuellen Zustand (PV, SOC, alle Meter-Lasten, H+) an `/ella_ems/sim/push`
2. `sim_api.py` schreibt eine `measurements`-Zeile pro Zähler (`source='SIM_PUSH'`)
3. `sim_api.py` berechnet Fluss und schreibt eine `power_states`-Zeile
4. Der laufende `inverter-controller` liest den neuen `power_states`-Eintrag und berechnet automatisch eine `control_decision`

**Push-Intervall:** Maximal 2s (dominiert den meter-collector mit 5s-Intervall, wenn beide laufen).

**Empfehlung:** `meter-collector` stoppen, bevor EMS-Sync aktiviert wird:
```bash
docker compose stop meter-collector
```

**Mutual Exclusion mit HW-Send:** Wenn ein Hardware-Send-Button aktiviert wird, deaktiviert das Frontend automatisch den EMS-Sync (Software-Push würde Hardware-Messwerte überschreiben).

### 4.5 Simulation API (`sim_api.py`)

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/sim/state` | GET | Aktuellen In-Memory-State + berechneten Fluss zurückgeben |
| `/sim/update` | POST | State selektiv aktualisieren (PV, SOC, Meter, Intervall) |
| `/sim/push` | POST | Zustand in EMS-DB schreiben; akzeptiert optionalen Body mit aktuellem State |
| `/sim/reset` | GET | State auf Defaultwerte zurücksetzen |
| `/sim/db_status` | GET | DB-Erreichbarkeit aus Simulation-Container prüfen |

Der State wird **im Prozessspeicher** gehalten — kein Persistenz-Backend. Nach Container-Neustart Reset auf Defaults.

---

## 5. Hardware-Simulation

### 5.1 Zweck und Abgrenzung

Die Hardware-Simulation ermöglicht es, **echte SmartMeter-Geräte** (z. B. Kaifa MA309, Siemens PAC, oder kompatible Geräte) direkt Messdaten in das EMS einspeisen zu lassen — ohne dass der `meter-collector` laufen muss.

Anwendungsfälle:
- Test mit echten Geräten in der Laborumgebung
- Pilot-Integration einzelner Zähler vor vollständiger Modbus-Implementierung
- Validierung der End-to-End-Datenpipeline (Zähler → EMS → Dashboard)
- Demo mit realen Verbrauchsdaten

Die Hardware-Simulation ist kein eigener Service — sie nutzt den `/smartmeter`-Endpunkt des bestehenden `simulation`-Services.

### 5.2 SmartMeter Push-Protokoll

Jedes Gerät sendet per HTTP POST an `POST /ella_ems/smartmeter`:

```json
{
  "LDT":   "2026-06-12T09:31:33+02:00",
  "LDTsm": "2026-06-12T09:31:33+02:00",
  "CID":   "1001",
  "Pact":  "0.523"
}
```

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `LDT` | ISO-8601 String | Zeitstempel des Messwerts (mit Timezone-Offset) |
| `LDTsm` | ISO-8601 String | Zeitstempel direkt vom Zähler (optional, kann leer sein) |
| `CID` | String | Custom ID des Geräts → wird auf `meter.cid` in der DB gemappt |
| `Pact` | String | Wirkleistung in **kW** (Dezimalzahl als String) |

**Antwort (Erfolg):**
```json
{"ok": true, "meter_id": "meter-01", "kw": 0.523, "ts": "2026-06-12T07:31:33Z"}
```

**Antwort (Fehler):**
```json
{"ok": false, "error": "Unbekannte CID: 9999"}
```

### 5.3 CID-Mapping

Jeder Zähler hat eine `cid`-Spalte in der `meters`-Tabelle (UNIQUE, nullable). Die CID ist die Geräte-eigene Kennung aus der Hardware-Konfiguration.

**Demo-Mapping:**

| CID | meter_id | Wohnung | Teilnehmer-Status |
|-----|----------|---------|-------------------|
| 1001 | meter-01 | Top 1 | B+ |
| 1002 | meter-02 | Top 2 | B+ |
| 1003 | meter-03 | Top 3 | B+ |
| 1004 | meter-04 | Top 4 | B+ |
| 1005 | meter-05 | Top 5 | B– |
| 1006 | meter-06 | Top 6 | B– |
| 1007 | meter-07 | H+ Wärmepumpe | H+ |

**DB-Migration für CID:** Die Spalte `cid` wurde nachträglich via `ALTER TABLE meters ADD COLUMN cid TEXT` hinzugefügt. Der UNIQUE-Index wurde separat angelegt (`CREATE UNIQUE INDEX IF NOT EXISTS idx_meters_cid ON meters(cid) WHERE cid IS NOT NULL`), da `ALTER TABLE ADD COLUMN` kein `UNIQUE` unterstützt.

### 5.4 Power States Neuberechnung (30s-Fenster)

Nach dem Eintreffen eines HW-Push-Messwerts wird `power_states` neu berechnet:

1. Alle aktiven Zähler in der DB laden
2. Pro Zähler: letzten Messwert abrufen — **aber nur wenn er ≤ 30s alt ist**
3. B+-Zähler und B–-Zähler summieren
4. PV-Leistung und Batterie-SOC aus der letzten `power_states`-Zeile übernehmen (Carry-Forward)
5. Neue `power_states`-Zeile schreiben

**Warum 30s-Fenster?** Das Push-Intervall der HW-Buttons im SimDashboard beträgt 10s. Wenn ein HW-Button deaktiviert wird, hört der Zähler auf zu senden. Der letzte gesendete Messwert würde ohne Zeitfenster dauerhaft in der Summierung bleiben. Mit dem 30s-Fenster fällt ein inaktiver Zähler nach maximal 3 ausgebliebenen Zyklen heraus.

**SQLite-Zeitvergleich:** Die gespeicherten Timestamps haben das Format `2026-06-12T18:47:26Z` (mit `T` und `Z`). SQLite's `datetime('now')` liefert `2026-06-12 18:47:26` (mit Leerzeichen). Da `T` (ASCII 84) > ` ` (ASCII 32), würde ein naiver String-Vergleich immer `True` ergeben. Korrekte Lösung:

```sql
AND timestamp_utc >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 seconds')
```

### 5.5 Frontend HW-Send Buttons (SimDashboard)

Jede Meter-Card zeigt einen „Hardware senden"-Button. Beim Aktivieren:

1. `hwSend: Set<string>` State wird um die Meter-ID erweitert
2. EMS-Sync wird automatisch deaktiviert (gegenseitiger Ausschluss)
3. Ein `setInterval` alle 10s sendet für diesen Zähler einen Push an `/ella_ems/smartmeter`
4. Der gesendete Wert ist die **aktuelle effektive Last** des Zählers: `Grundlast + AC-Zuschlag + Wallbox-Zuschlag`

**Stale-Closure-Vermeidung:** Weil `setInterval` eine Closure über den Anfangszustand bildet, wird der aktuelle Meter-State per `useRef` referenziert:

```typescript
const metersRef = useRef(meters)
useEffect(() => { metersRef.current = meters }, [meters])

// Im Interval-Callback:
const cur = metersRef.current.find(m => m.id === mid)
```

**Orange-Banner:** Wenn HW-Send aktiv ist, erscheint ein Hinweis-Banner mit dem Hinweis, den `meter-collector` zu stoppen.

### 5.6 Zusammenspiel der drei Einspeise-Modi

| Modus | Quelle | `source`-Flag | Power-States-Schreiber |
|-------|--------|---------------|------------------------|
| **meter-collector** | Simulation/Modbus | `SIMULATION` | meter-collector (alle 5s, alle Zähler gleichzeitig) |
| **SW-Simulation** | SimDashboard `/sim/push` | `SIM_PUSH` | simulation (konfigurierbar, min. 2s) |
| **HW-Push** | Echtes Gerät `/smartmeter` | `HW_PUSH` | simulation (pro Empfang, alle aktiven Zähler der letzten 30s) |

Die drei Modi können grundsätzlich gleichzeitig laufen, was zu wechselseitigem Überschreiben führt. Empfohlene Konfiguration je Anwendungsfall:

| Anwendungsfall | Empfehlung |
|----------------|------------|
| Demo ohne Hardware | meter-collector stoppen, SW-Sync aktivieren |
| Test mit echter Hardware | meter-collector stoppen, HW-Send aktivieren |
| Produktivbetrieb | meter-collector läuft, SW-Sim und HW-Sim aus |
| Hybrid (Pilot) | meter-collector stoppen, HW-Send für Pilot-Zähler, Rest per SW-Sim |

---

## 6. Datenmodell

### 6.1 Timestamp-Konvention

Alle `*_utc`-Spalten speichern UTC-Zeitstempel als ISO-8601-String **mit T und Z-Suffix**: `2026-06-12T18:47:26Z`. Dieser Wert ist direkt von JavaScript `new Date().toISOString()` und Python `datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')` kompatibel.

Frontend-Darstellung: Immer über `utils/time.ts` (`utcToDate()`, `fmtLocalTime()`, `fmtLocalDateTime()`) nach de-AT-Lokalzeit konvertieren.

### 6.2 Kerntabellen

**`measurements`** — Rohe Zählermesswerte

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `meter_id` | TEXT | Referenz auf `meters.id` |
| `timestamp_utc` | TEXT | Messpunkt in UTC |
| `active_power_w` | REAL | Wirkleistung in Watt |
| `quality_flag` | TEXT | `OK \| STALE \| ESTIMATED \| INVALID \| COMM_ERROR` |
| `source` | TEXT | `SIMULATION \| MODBUS \| SIM_PUSH \| HW_PUSH` |

**`power_states`** — Aggregierte Anlagenzustände

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `bplus_power_w` | REAL | Summenlast aller B+/H+-Zähler |
| `bminus_power_w` | REAL | Summenlast aller B–-Zähler |
| `pv_power_w` | REAL | PV-Einspeisung (kann NULL sein wenn unbekannt) |
| `battery_soc_pct` | REAL | Batterie-Ladezustand in % |
| `valid_meter_count` | INTEGER | Anzahl Zähler mit aktuellem Messwert |
| `invalid_meter_count` | INTEGER | Anzahl Zähler ohne aktuellen Messwert |

**`meters`** — Zählerregistrierung

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | TEXT | z. B. `meter-01` |
| `cid` | TEXT UNIQUE | SmartMeter Hardware Custom-ID (z. B. `1001`) |
| `protocol` | TEXT | `SIMULATION \| MODBUS_TCP \| MODBUS_RTU` |
| `apartment_id` | TEXT | Zugehörige Wohnung (NULL für H+ Gemeinschaftszähler) |

**`settlement_intervals`** — 15-Minuten-Abrechnung

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `interval_start_utc` | TEXT | Intervallbeginn (UNIQUE pro Site) |
| `bplus_consumption_wh` | REAL | Gesamtverbrauch B+/H+ im Intervall |
| `local_energy_available_wh` | REAL | Verfügbare Lokalenergie im Intervall |
| `settlement_status` | TEXT | `OPEN \| CALCULATED \| APPROVED \| LOCKED` |
| `plausibility_status` | TEXT | `PENDING \| OK \| WARNING \| FAILED` |

### 6.3 Demo-Stammdaten (Seed)

- **Site:** `site-demo-01` — „Ella Demo Anlage", Musterstraße 1, 1010 Wien
- **Gebäude:** `bld-01` — Haus A
- **Wohnungen:** Top 1–6 (EG: 1+2, OG1: 3+4, OG2: 5+6)
- **Zähler:** meter-01 bis meter-07 (meter-07 = H+ Wärmepumpe)
- **Teilnehmer:** part-01..04 = B+ (Top 1–4), part-05..06 = B– (Top 5–6)
- **Tarif:** 8 ct/kWh lokal, 28 ct/kWh Netz, 2 ct/kWh Service

---

## 7. API-Referenz

**Base-URL (Produktion):** `https://www.sailersoft.com/ella_ems/api/`  
**Base-URL (Lokal):** `http://localhost/ella_ems/api/`  
**Swagger UI:** `<base>/docs`

### EMS API

| Endpunkt | Methode | Query/Body | Beschreibung |
|----------|---------|------------|--------------|
| `/health` | GET | — | Service-Health + DB-Konnektivität |
| `/dashboard/operator` | GET | `?range=1800` | Power-State, History (Sekunden), Alarme, heute |
| `/dashboard/resident/:id` | GET | — | Teilnehmer heute/Monat: Verbrauch, Einsparungen |
| `/dashboard/devices` | GET | — | Wechselrichter + Batterie, letzte Entscheidung |
| `/meters/status` | GET | — | Alle Zähler + letzter Messwert |
| `/meters/:id/latest` | GET | — | Letzter Messwert eines Zählers |
| `/participants` | GET | — | Alle Teilnehmer |
| `/alarms` | GET | — | Letzte 100 Alarme |
| `/alarms/active` | GET | — | Nur aktive Alarme |
| `/alarms/:id/ack` | POST | — | Alarm quittieren |
| `/alarms/:id/close` | POST | — | Alarm schließen |
| `/control-decisions` | GET | `?limit=20` | Letzte Regelentscheidungen |
| `/control-decisions/latest` | GET | — | Letzte Einzelentscheidung |
| `/settlement/intervals` | GET | `?month=2026-05` | Alle 15-min-Intervalle eines Monats |
| `/settlement/summary` | GET | `?month=2026-05` | Monatstotale |
| `/settlement/plausibility` | GET | `?month=2026-05` | Plausibilitätsprüfung |
| `/settlement/approve` | POST | `{month}` | Monat für Abrechnung sperren |
| `/reports` | GET | — | Letzte 100 Report-Jobs |
| `/reports/generate` | POST | `{report_type, month, participant_id?, include_detail?}` | Report-Job anlegen |
| `/reports/:id/download` | GET | — | Datei streamen |

### Simulation API

| Endpunkt | Methode | Body | Beschreibung |
|----------|---------|------|--------------|
| `/sim/state` | GET | — | In-Memory-State + berechneter Fluss |
| `/sim/update` | POST | `{pv_kw?, soc_pct?, meters?, interval_s?}` | State partiell updaten |
| `/sim/push` | POST | State (optional) | State in EMS-DB schreiben |
| `/sim/reset` | GET | — | State auf Defaults zurücksetzen |
| `/sim/db_status` | GET | — | DB-Erreichbarkeit prüfen |

### SmartMeter HW-Push

| Endpunkt | Methode | Body | Beschreibung |
|----------|---------|------|--------------|
| `/smartmeter` | POST | `{LDT, LDTsm, CID, Pact}` | Einzel-Messwert von Hardware-Gerät empfangen |

---

## 8. Deployment-Topologie

### 8.1 Lokal (Entwicklung, Windows)

```
Docker Desktop (Windows, VirtioFS)
└── ella_ems_default Netzwerk
    ├── ella-nginx         (:80)
    ├── ella-backend-api   (:3000, intern)
    ├── ella-simulation    (:8080, intern)
    ├── ella-inverter-controller
    ├── ella-settlement-worker
    └── ella-reporting-worker

ella-meter-collector  ← nur mit --profile collector
```

Frontend-Entwicklung ohne Docker: `npm run dev` im `frontend/`-Verzeichnis (Vite Dev-Server mit Proxy).

### 8.2 Produktion (Ubuntu, www.sailersoft.com)

```
Ubuntu Server
├── /home/ella/app/web/           ← sailersoft Compose-Projekt
│   └── docker-compose.yml
│       ├── oracle-xe             (Port 1521, intern)
│       ├── ords                  (Port 8080, intern)
│       └── nginx                 (Port 80/443)
│           ├── /                 → /usr/share/nginx/html/
│           ├── /ords/            → http://ords:8080
│           ├── /ella_ems/api/    → http://ella-backend-api:3000
│           ├── /ella_ems/sim/    → http://ella-simulation:8080
│           ├── /ella_ems/smartmeter → http://ella-simulation:8080
│           └── /ella_ems/        → /home/ella/app/ella_ems/frontend/dist/
│
└── /home/ella/app/ella_ems/      ← ella Compose-Projekt
    └── docker-compose.yml + docker-compose.prod.yml
        ├── ella-backend-api      (kein Port-Mapping nach außen)
        ├── ella-simulation       (kein Port-Mapping nach außen)
        ├── ella-inverter-controller
        ├── ella-settlement-worker
        └── ella-reporting-worker

Geteiltes Netzwerk: "webnet" (external)
→ sailersoft-nginx und ella-backend-api/ella-simulation kommunizieren per Container-Name
```

**Wichtige Regel Produktion:** Alle `docker compose`-Befehle müssen beide Files angeben:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml <command>
```

Sonst fehlt der `webnet`-Netzwerk-Attach → sailersoft-nginx findet die ella-Container nicht → 404/502.

### 8.3 nginx-Konfiguration Produktion

Die Ella-Location-Blocks sind eingetragen in:
```
/home/ella/app/web/nginx/conf.d/default.conf
```

Referenz-Datei im Repo: `nginx/sailersoft-location-blocks.conf`

SPA-Fallback (vermeidet nginx-Redirect-Cycle bei alias + try_files):
```nginx
location /ella_ems/ {
    alias /home/ella/app/ella_ems/frontend/dist/;
    index index.html;
    try_files $uri $uri/ @ella_spa;
}
location @ella_spa {
    root /home/ella/app/ella_ems/frontend/dist;
    rewrite .* /index.html break;
}
```

Das `frontend/dist/`-Verzeichnis ist als Volume in den sailersoft-nginx-Container gemountet:
```yaml
- /home/ella/app/ella_ems/frontend/dist:/home/ella/app/ella_ems/frontend/dist:ro
```

---

## 9. Bekannte Einschränkungen & Roadmap

### Nicht implementiert

| Feature | Status | Beschreibung |
|---------|--------|--------------|
| JWT-Authentifizierung | Offen | `POST /api/auth/login` gibt 501 zurück. Alle Endpunkte sind offen. Geplant: JWT mit Rollen (admin, operator, resident, ops, solarel). |
| Modbus TCP/RTU | Stub | `meter-collector` hat Code-Pfade für Modbus, aber nur SIMULATION ist implementiert. |
| Alarm-Worker | Stub | `services/alarm-worker/` existiert, aber keine Implementierung. Alarm-Erstellung nur manuell via API. |
| B+-Status DB-Sync aus Simulation | Offen | Der B+-Toggle im SimDashboard schreibt nicht in `participants`. Settlement und Bewohner-Dashboard nutzen immer den DB-Status. |
| Settlement-Freigabe-UI | Minimal | `LOCKED`-Status existiert, aber die Genehmigungsmaske ist rudimentär. |
| PV- und Batterie-Messung | Simulation | PV-Leistung und SOC kommen aus der Simulation oder werden aus letztem `power_states`-Eintrag übernommen. Keine echte Kommunikation mit Wechselrichter-API. |

### Bekannte Verhaltensweisen

- **HW-Push ohne meter-collector:** Der inverter-controller liest `power_states` und rechnet Control-Decisions. Er läuft unabhängig — auch wenn nur HW-Push-Daten kommen, werden Sollwerte berechnet.
- **Simultanbetrieb meter-collector + HW-Push:** Beide schreiben `measurements` und `power_states`. Die Werte überschreiben sich wechselseitig im 5s/10s-Takt. Für saubere Tests einen der Modi stoppen.
- **SOC-Simulation nur im Frontend:** Der simulierte SOC wird im Browser-State (SimDashboard) berechnet und bei EMS-Sync an den `sim/push`-Endpunkt übertragen. Der inverter-controller rechnet selbst keinen SOC — er liest ihn aus `power_states`.
- **Berichtsgenerierung blockiert:** `reporting-worker` verarbeitet einen Job nach dem anderen. Bei vielen gleichzeitigen PDF-Jobs kann die Queue wachsen.

### Nächste Schritte (Roadmap)

1. **JWT-Authentifizierung** — Login-Flow, Token-Refresh, rollenbasierter Zugriff
2. **Modbus TCP** — Echte Zähleranbindung für Pilot-Installation
3. **Wechselrichter-Steuerung** — Echter Modbus-Setpoint statt Simulation
4. **Push-Benachrichtigungen** — WebSocket oder SSE für Live-Updates (statt Polling)
5. **Alarm-Worker** — Automatische Alarmgenerierung bei Kommunikationsausfall, SOC-Grenzwerten
6. **Multi-Site-Unterstützung** — Mehrere Anlagen unter einem Backend
