# Ella Edge EMS V1 – Implementierungsspezifikation

**Projekt:** Ella Edge EMS für Mehrparteienwohnanlagen  
**Dokument:** `instructions.md`  
**Version:** V1.0 – MVP-Implementierungskonzept  
**Stand:** 2026-06-06  
**Zielgruppe:** Sailer Engineering, Solarel, Softwareentwicklung, IT-Operations, technische Projektleitung

---

## 1. Zielsetzung

Ella Edge EMS V1 ist ein lokal betriebenes intelligentes Energiemanagementsystem für Mehrparteienwohnanlagen mit PV-Anlage, Batteriespeicher, Wechselrichter und Smart Metern.

Das System ermöglicht, dass nur teilnehmende Bewohner einer Energiegemeinschaft, im Konzept als **B+ Teilnehmer** bezeichnet, bilanziell und abrechnungstechnisch lokalen PV-/Speicherstrom erhalten. Nicht teilnehmende Bewohner, im Konzept als **B- Teilnehmer** bezeichnet, bleiben beim Standard-Stromanbieter und werden nicht an der lokalen PV-/Speicheranlage beteiligt.

Die technische Kernfunktion besteht darin, die aktuellen Smart-Meter-Werte der einzelnen Wohneinheiten lokal auszulesen, daraus die aktuelle Leistungssumme der B+ Teilnehmer zu berechnen und den Wechselrichter beziehungsweise Batteriespeicher so anzusteuern, dass die lokale Anlage nach Möglichkeit genau diesen B+ Bedarf bedient.

Die offizielle Abrechnung und der Nachweis erfolgen auf Basis von 15-Minuten-Intervallen. Die technische Regelung darf und soll deutlich feiner arbeiten, zum Beispiel im Bereich von 1 bis 5 Sekunden.

---

## 2. Leitprinzipien

### 2.1 Lokaler Edge-Betrieb

Ella Edge EMS V1 läuft vollständig lokal am Edge-System im Schaltschrank. Die Steuerung des Wechselrichters darf nicht von einer Cloud-Verbindung abhängig sein.

Vorteile:

- geringe Latenz
- Betrieb auch bei Internetausfall
- klare lokale Verantwortung
- einfache Pilotierbarkeit
- gute Nachvollziehbarkeit
- robuste Inbetriebnahme im Schaltschrank

### 2.2 Containerisierung

Alle Softwaremodule laufen in Docker-Containern. Dadurch werden Installation, Updates, Tests und Diagnose reproduzierbar.

### 2.3 SQLite-first

Die V1-Datenhaltung basiert primär auf SQLite. PostgreSQL wird konzeptionell vorbereitet, ist aber für den ersten MVP nicht zwingend erforderlich.

### 2.4 REST-first

Die Kommunikation zwischen UI und Backend erfolgt über REST APIs. Interne Services können in V1 ebenfalls REST, direkte Datenbankzugriffe oder einfache lokale Service-Kommunikation verwenden.

### 2.5 RabbitMQ optional

RabbitMQ wird für Events optional vorbereitet, aber nicht zwingend für den ersten MVP vorausgesetzt. Das System soll auch ohne RabbitMQ lauffähig sein.

### 2.6 Nachvollziehbarkeit vor Optimierung

V1 fokussiert nicht auf KI-Optimierung, Börsenstromhandel oder komplexe Tarife. V1 fokussiert auf:

- korrektes Messen
- korrektes Zuordnen
- korrektes Steuern
- korrektes Protokollieren
- korrektes Abrechnen
- verständliche Darstellung für Bewohner und Betreiber

---

## 3. Fachlicher Systemkontext

### 3.1 Ausgangssituation

Eine Mehrparteienwohnanlage verfügt über:

- PV-Anlage
- Wechselrichter
- große Batterie
- Smart Meter je Wohneinheit
- lokales Hausnetz
- Bewohner mit unterschiedlichem Teilnahmezustand

Es gibt zwei Bewohnergruppen:

| Gruppe | Bedeutung |
|---|---|
| B+ | Teilnehmer an der lokalen PV-/Speicher-/Energiegemeinschaft |
| B- | Nicht-Teilnehmer, bleibt beim Standard-Stromanbieter |

### 3.2 Fachlicher Grundsatz

Das System kann physikalisch nicht einzelne Elektronen einer bestimmten Wohnung zuordnen. Es kann aber messtechnisch, steuerungstechnisch und abrechnungstechnisch sicherstellen, dass die lokale PV-/Speicherleistung nur im Umfang des aktuellen B+ Bedarfs bereitgestellt und später nachvollziehbar zugeordnet wird.

Der zentrale fachliche Ausdruck lautet:

```text
Mein Verbrauch = lokaler Gemeinschaftsstrom + Ergänzung aus dem öffentlichen Netz
```

### 3.3 Winterfall mit Teildeckung

Wenn in einem 15-Minuten-Intervall alle B+ Bewohner zusammen 10 kWh verbrauchen, aber aus PV/Speicher nur 2 kWh lokal verfügbar sind, beträgt der lokale Deckungsgrad:

```text
2 kWh / 10 kWh = 20 %
```

Dann erhält jeder B+ Teilnehmer in diesem Intervall proportional zu seinem Verbrauch 20 % lokalen Gemeinschaftsstrom und 80 % Netzstrom.

---

## 4. Rollenmodell

### 4.1 B+ Bewohner

Teilnehmender Bewohner der Energiegemeinschaft.

Benötigte Antworten:

- Wie viel Strom habe ich verbraucht?
- Wie viel davon kam lokal aus PV/Speicher?
- Wie viel kam aus dem öffentlichen Netz?
- Wie hoch war mein lokaler Deckungsgrad?
- Welchen wirtschaftlichen Vorteil hatte ich?
- Ist meine Abrechnung nachvollziehbar?

### 4.2 B- Bewohner

Nicht teilnehmender Bewohner.

Benötigte Antwort:

- Bin ich technisch oder abrechnungstechnisch betroffen?

Zielantwort:

```text
Nein. Ihr Verbrauch bleibt getrennt. Sie werden nicht an PV/Speicher beteiligt.
```

B- Bewohner benötigen in V1 kein eigenes Portal.

### 4.3 Betreiber der Energiegemeinschaft

Kann Hausverwaltung, Eigentümergemeinschaft, Betreibergesellschaft oder Solarel sein.

Benötigte Antworten:

- Läuft die Anlage?
- Wie hoch ist der lokale Deckungsgrad?
- Welche Teilnehmer sind B+?
- Welche Teilnehmer sind B-?
- Sind alle Messwerte vollständig?
- Gibt es Alarme oder Abweichungen?
- Ist die Monatsabrechnung plausibel?
- Können Reports freigegeben werden?

### 4.4 Solarel 1st-Level Operator

Solarel betreut Anlagen operativ und benötigt eine schnelle Störungs- und Anlagenübersicht.

Benötigte Antworten:

- Welche Anlagen laufen?
- Welche Anlage hat einen Fehler?
- Welcher Smart Meter ist offline?
- Welcher Wechselrichter ist offline?
- Gibt es Abrechnungsprobleme?
- Muss ein Techniker vor Ort?
- Muss an Sailer Engineering eskaliert werden?

### 4.5 Sailer Engineering 2nd-Level / Software Operations

Sailer Engineering benötigt die technische Tiefensicht.

Benötigte Antworten:

- Ist der Edge-Rechner erreichbar?
- Laufen alle Container?
- Welche Version ist installiert?
- Welche Regelentscheidung wurde warum getroffen?
- Gibt es Datenbankfehler?
- Gibt es API-Timeouts?
- Welche Logs sind relevant?
- Ist ein Update oder Rollback notwendig?

### 4.6 Admin

Adminrolle für Setup und Parametrierung.

Aufgaben:

- Anlagen anlegen
- Benutzer verwalten
- Rollen vergeben
- Smart Meter zuordnen
- Wechselrichter konfigurieren
- Teilnehmerstatus B+/B- verwalten
- Tarife pflegen
- Abrechnungsparameter setzen
- Exporte konfigurieren

### 4.7 Externe Organisationen

| Organisation | Relevanz |
|---|---|
| Netzbetreiber | Smart Meter, Netzanschluss, Einspeisegrenzen |
| EVU / Stromanbieter | Reststromlieferung, Vertragsdaten |
| Energiegemeinschaft / Abrechnungsstelle | Teilnehmer, Zuordnung, Abrechnung |
| Steuerberater / Buchhaltung | Monats-/Jahresdaten |
| Prüfer / Förderstelle | Nachweise, Audit |
| Wechselrichterhersteller | technische Schnittstelle, Firmware, Status |

---

## 5. Zielarchitektur V1

### 5.1 Gesamtbild

```text
Mehrparteienhaus / Schaltschrank
│
├── Smart Meter B+
├── Smart Meter B-
├── Wechselrichter / Batterie
│
└── Ella Edge Box
    ├── Docker Runtime
    ├── NGINX Webserver
    ├── React/Tailwind Frontend
    ├── Bun/Node.js TypeScript Backend
    ├── Python Worker / Device Adapter
    ├── SQLite Datenbank
    ├── optionale RabbitMQ Event-Kommunikation
    ├── lokale Logs
    └── SSH Remote-Zugang
```

### 5.2 Container-Zielbild

```text
ella-edge-v1
│
├── nginx
│   └── Webserver / Reverse Proxy
│
├── frontend
│   └── React + Tailwind Build
│
├── backend-api
│   └── Bun / Node.js / TypeScript REST API
│
├── meter-collector
│   └── Smart-Meter-Auslesung
│
├── inverter-controller
│   └── Wechselrichter- und Batterieansteuerung
│
├── settlement-worker
│   └── 15-Minuten-Bilanz und Zuordnung
│
├── reporting-worker
│   └── PDF, CSV, JSON Reports
│
├── rabbitmq optional
│   └── Event-Bus für V2-Readiness
│
└── database-volume
    └── SQLite-Datei oder später PostgreSQL-Datenverzeichnis
```

---

## 6. Technologiestack

| Bereich | Entscheidung V1 |
|---|---|
| Edge Hardware | MiniPC / ODROID / DIN-Rail-PC |
| Betriebssystem | Ubuntu Server oder Debian |
| Container | Docker + Docker Compose |
| Frontend | React |
| Styling | Tailwind CSS |
| Webserver | NGINX |
| Backend API | Bun / Node.js + TypeScript |
| Hardware-nahe Services | Python |
| Datenbank | SQLite |
| Alternative Datenbank | PostgreSQL vorbereitet |
| Interne Kommunikation | REST + lokale DB |
| Event-Kommunikation | RabbitMQ optional |
| Reports | PDF, CSV, JSON |
| Logs | lokale Files + Audit-Tabellen |
| Deployment | Git + Docker Compose |
| Remote V1 | SSH + Passwort |
| Remote V2 | WireGuard / Tailscale |
| Lokale Security V2 | NGINX mTLS |
| Versionierung | Git Monorepo |

---

## 7. Git-Repository-Struktur

Empfohlen wird ein Monorepo:

```text
ella-edge-ems/
├── README.md
├── instructions.md
├── docker-compose.yml
├── .env.example
│
├── docs/
│   ├── architecture.md
│   ├── deployment.md
│   ├── api.md
│   ├── database.md
│   ├── security.md
│   ├── operations.md
│   └── simulation.md
│
├── frontend/
│   └── React + Tailwind
│
├── backend-api/
│   └── Bun + TypeScript REST API
│
├── services/
│   ├── meter-collector/
│   ├── inverter-controller/
│   ├── settlement-worker/
│   ├── reporting-worker/
│   └── alarm-worker/
│
├── shared/
│   ├── types/
│   ├── schemas/
│   └── protocol/
│
├── database/
│   ├── migrations/
│   ├── seed/
│   └── schema.sql
│
├── nginx/
│   ├── nginx.conf
│   └── certs/
│
├── config/
│   ├── site.example.json
│   ├── participants.example.json
│   ├── meters.example.json
│   ├── inverter.example.json
│   ├── battery.example.json
│   └── tariffs.example.json
│
├── data/
│   └── .gitkeep
│
├── logs/
│   └── .gitkeep
│
├── reports/
│   └── .gitkeep
│
├── scripts/
│   ├── install.sh
│   ├── backup.sh
│   ├── restore.sh
│   ├── update.sh
│   ├── diagnostics.sh
│   └── reset-demo-data.sh
│
└── tests/
    ├── integration/
    ├── simulation/
    └── fixtures/
```

---

## 8. Docker Compose V1

Beispielstruktur:

```yaml
services:
  nginx:
    image: nginx:stable
    container_name: ella-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - backend-api
    restart: unless-stopped

  backend-api:
    build: ./backend-api
    container_name: ella-backend-api
    environment:
      - ELLA_DB_PATH=/data/ella-edge.db
      - ELLA_CONFIG_DIR=/config
    volumes:
      - ./data:/data
      - ./config:/config
      - ./logs/backend-api:/logs
      - ./reports:/reports
    restart: unless-stopped

  meter-collector:
    build: ./services/meter-collector
    container_name: ella-meter-collector
    environment:
      - ELLA_DB_PATH=/data/ella-edge.db
      - ELLA_CONFIG_DIR=/config
    volumes:
      - ./data:/data
      - ./config:/config
      - ./logs/meter-collector:/logs
    restart: unless-stopped

  inverter-controller:
    build: ./services/inverter-controller
    container_name: ella-inverter-controller
    environment:
      - ELLA_DB_PATH=/data/ella-edge.db
      - ELLA_CONFIG_DIR=/config
    volumes:
      - ./data:/data
      - ./config:/config
      - ./logs/inverter-controller:/logs
    restart: unless-stopped

  settlement-worker:
    build: ./services/settlement-worker
    container_name: ella-settlement-worker
    environment:
      - ELLA_DB_PATH=/data/ella-edge.db
      - ELLA_CONFIG_DIR=/config
    volumes:
      - ./data:/data
      - ./config:/config
      - ./logs/settlement-worker:/logs
    restart: unless-stopped

  reporting-worker:
    build: ./services/reporting-worker
    container_name: ella-reporting-worker
    environment:
      - ELLA_DB_PATH=/data/ella-edge.db
      - ELLA_CONFIG_DIR=/config
    volumes:
      - ./data:/data
      - ./config:/config
      - ./reports:/reports
      - ./logs/reporting-worker:/logs
    restart: unless-stopped

  rabbitmq:
    image: rabbitmq:3-management
    container_name: ella-rabbitmq
    profiles:
      - events
    ports:
      - "15672:15672"
    restart: unless-stopped
```

RabbitMQ soll nur bei Bedarf aktiviert werden:

```bash
docker compose --profile events up -d
```

---

## 9. Softwaremodule

### 9.1 NGINX

Aufgaben V1:

- Auslieferung des React Frontends
- Reverse Proxy auf `/api`
- optional HTTPS
- optional Basic Auth im lokalen Testbetrieb
- Logging von Zugriffen

Aufgaben V2:

- mTLS
- Zertifikatsprüfung
- Security Header
- Rate Limiting
- Trennung Bewohnernetz / Adminzugriff

### 9.2 Frontend

Technologie:

- React
- Tailwind CSS
- REST API Client
- Chart-Komponenten
- rollenbasierte Navigation

Wichtige UI-Bereiche:

```text
/dashboard
/participants
/meters
/devices
/energy-flow
/settlement
/reports
/alarms
/ops
/admin
```

Spätere Bewohnerbereiche:

```text
/resident/dashboard
/resident/history
/resident/billing
/resident/help
```

### 9.3 Backend API

Technologie:

- Bun
- Node.js Runtime-Kompatibilität
- TypeScript
- REST API
- SQLite Zugriff
- Authentifizierung
- Rollenprüfung
- Report-Verwaltung
- Konfigurationsverwaltung

Struktur:

```text
backend-api/
├── src/
│   ├── main.ts
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   ├── domain/
│   ├── auth/
│   ├── config/
│   ├── db/
│   └── utils/
```

### 9.4 MeterCollector

Aufgaben:

- Smart Meter zyklisch auslesen
- Messwerte validieren
- Qualitätsflags setzen
- Rohwerte speichern
- Kommunikationsfehler erkennen
- Alarme erzeugen

Unterstützte Modi:

- Simulation
- Modbus TCP
- Modbus RTU / RS485
- später M-Bus / Wireless M-Bus
- später Hersteller-APIs

MVP-Muss:

- Simulationsmodus
- mindestens ein echter oder simulierter Modbus-Pfad

### 9.5 PowerAggregator

Kann in V1 Teil des InverterControllers oder Backends sein.

Aufgaben:

- aktuelle B+ Leistung berechnen
- aktuelle B- Leistung berechnen
- Gesamtlast berechnen
- Hysterese anwenden
- ungültige Messwerte ausschließen
- aktuellen `PowerState` schreiben

### 9.6 InverterController

Aufgaben:

- Wechselrichterstatus lesen
- Batteriestatus lesen
- SOC prüfen
- Entladegrenzen prüfen
- Sollwert berechnen
- Sollwert senden
- Istwert zurücklesen
- Regelentscheidung speichern
- Alarme erzeugen

MVP-Muss:

- Simulationsmodus
- Sollwertberechnung
- Regelentscheidungsprotokoll
- Failsafe bei Kommunikationsausfall

### 9.7 SettlementWorker

Aufgaben:

- 15-Minuten-Intervalle schließen
- Verbrauch je Teilnehmer berechnen
- lokale verfügbare Energie bestimmen
- lokalen Zuordnungsfaktor berechnen
- lokale Energie je B+ Teilnehmer zuordnen
- Netzanteil berechnen
- Plausibilitätsprüfung durchführen
- Abrechnungsdaten vorbereiten

Standard-Verteilmodell V1:

```text
proportional nach Verbrauch je 15-Minuten-Intervall
```

### 9.8 ReportingWorker

Aufgaben:

- Bewohner-Monatsreport erzeugen
- Betreiberreport erzeugen
- CSV-Detailnachweis erzeugen
- JSON-Export erzeugen
- Auditreport erzeugen
- Diagnosepaket erzeugen

Reportformate:

- PDF
- CSV
- JSON
- ZIP für Diagnoseexport

### 9.9 AlarmService

Kann V1 im Backend integriert sein.

Aufgaben:

- Alarme erstellen
- Alarme anzeigen
- Alarme quittieren
- Alarmhistorie führen
- Alarmklasse setzen

Alarmklassen:

```text
INFO
WARNING
ERROR
CRITICAL
```

---

## 10. Datenmodell V1

### 10.1 Kernobjekte

```text
Site
Building
Apartment
Participant
Meter
Device
Measurement
PowerState
ControlDecision
InverterSetpoint
SettlementInterval
SettlementParticipantAllocation
Tariff
Invoice
Report
Alarm
AuditEvent
User
Role
ConfigVersion
```

### 10.2 Tabellenübersicht

```text
sites
buildings
apartments
participants
meters
devices
measurements
power_states
control_decisions
inverter_setpoints
settlement_intervals
settlement_participant_allocations
tariffs
invoices
reports
alarms
audit_events
users
roles
user_roles
config_versions
system_logs
```

### 10.3 Tabelle `participants`

```text
id
site_id
apartment_id
display_name
participant_status      -- BPLUS / BMINUS
meter_id
tariff_id
valid_from
valid_to
is_active
created_at
updated_at
```

### 10.4 Tabelle `measurements`

```text
id
site_id
meter_id
timestamp_utc
active_power_w
energy_import_wh
energy_export_wh
voltage_v
current_a
power_factor
quality_flag
source
created_at
```

Qualitätsflags:

```text
OK
STALE
ESTIMATED
INVALID
COMM_ERROR
```

### 10.5 Tabelle `control_decisions`

Diese Tabelle ist für Nachvollziehbarkeit zentral.

```text
id
site_id
timestamp_utc
bplus_power_w
bminus_power_w
total_power_w
battery_soc_percent
pv_power_w
max_allowed_discharge_w
calculated_setpoint_w
sent_setpoint_w
actual_inverter_power_w
decision_status
reason
algorithm_version
config_version_id
created_at
```

Beispiele für `reason`:

```text
OK_BPLUS_DEMAND_MATCHED
LIMITED_BY_BATTERY_SOC
LIMITED_BY_INVERTER_MAX
NO_VALID_METER_DATA
INVERTER_OFFLINE
FAILSAFE_ACTIVE
```

### 10.6 Tabelle `settlement_intervals`

```text
id
site_id
interval_start_utc
interval_end_utc
bplus_consumption_wh
bminus_consumption_wh
local_energy_available_wh
local_allocation_factor
grid_energy_bplus_wh
settlement_status
plausibility_status
created_at
approved_at
approved_by
```

### 10.7 Tabelle `settlement_participant_allocations`

```text
id
settlement_interval_id
participant_id
consumption_wh
local_energy_wh
grid_energy_wh
local_coverage_percent
tariff_local_amount
tariff_service_amount
created_at
```

### 10.8 Tabelle `audit_events`

```text
id
timestamp_utc
user_id
event_type
entity_type
entity_id
old_value_json
new_value_json
reason
source_ip
created_at
```

Auditpflichtige Ereignisse:

- Login
- Logout
- Teilnehmeränderung
- Tarifänderung
- Wechselrichterparameteränderung
- Abrechnungsfreigabe
- Reporterzeugung
- Konfigurationsänderung
- Update
- Backup
- Restore

---

## 11. Regelalgorithmus V1

### 11.1 Eingangswerte

- aktuelle Leistung je Smart Meter
- Teilnehmerstatus B+ / B-
- Batteriestatus
- Wechselrichterstatus
- PV-Leistung
- technische Limits
- Mindest-SOC
- Hysterese
- letzte Regelentscheidung

### 11.2 Berechnung

```text
P_Bplus = Summe gültiger aktueller Leistungen aller B+ Teilnehmer
P_Bminus = Summe gültiger aktueller Leistungen aller B- Teilnehmer
P_total = P_Bplus + P_Bminus
```

Zielwert:

```text
P_target = P_Bplus
```

Begrenzung:

```text
P_target_limited =
    min(
        P_Bplus,
        max_inverter_discharge_w,
        max_battery_discharge_w,
        grid_connection_limit_w,
        optional_participant_limit_w
    )
```

SOC-Regel:

```text
Wenn battery_soc_percent < min_soc_percent:
    P_target_limited = 0
```

Hysterese:

```text
Wenn abs(P_target_limited - last_sent_setpoint_w) < hysteresis_w:
    keinen neuen Sollwert senden
```

Failsafe:

```text
Wenn zu wenige gültige Messwerte:
    Wechselrichter-Sollwert reduzieren oder auf 0 setzen

Wenn Wechselrichter nicht erreichbar:
    Alarm erzeugen und Regelung pausieren

Wenn Batteriefehler:
    Entladung stoppen
```

### 11.3 Regelentscheidungsprotokoll

Jeder Regelzyklus erzeugt mindestens dann einen Eintrag, wenn:

- ein neuer Sollwert gesendet wurde
- ein Fehler aufgetreten ist
- ein Limit aktiv wurde
- ein Failsafe aktiv wurde
- eine signifikante Änderung erkannt wurde

---

## 12. 15-Minuten-Settlement

### 12.1 Ziel

Das Settlement erzeugt die abrechnungsrelevante Zuordnung des lokalen Gemeinschaftsstroms je B+ Teilnehmer.

### 12.2 Standardmodell V1

V1 verwendet ein proportional-verbrauchsbasiertes Modell.

Formel:

```text
local_allocation_factor =
    local_energy_available_wh / bplus_consumption_wh
```

Begrenzung:

```text
local_allocation_factor <= 1.0
```

Teilnehmerzuordnung:

```text
participant_local_energy_wh =
    participant_consumption_wh * local_allocation_factor

participant_grid_energy_wh =
    participant_consumption_wh - participant_local_energy_wh
```

### 12.3 Winterbeispiel

```text
B+ Gesamtverbrauch:        10.000 Wh
lokal verfügbar:            2.000 Wh
lokaler Faktor:                20 %
Netzanteil:                    80 %
```

| Teilnehmer | Verbrauch | Lokal 20 % | Netz 80 % |
|---|---:|---:|---:|
| Wohnung 1 | 1.000 Wh | 200 Wh | 800 Wh |
| Wohnung 2 | 3.000 Wh | 600 Wh | 2.400 Wh |
| Wohnung 3 | 6.000 Wh | 1.200 Wh | 4.800 Wh |

### 12.4 Plausibilitätsregeln

- lokale Zuordnung darf lokale verfügbare Energie nicht überschreiten
- B- Teilnehmer dürfen keine lokale Zuordnung erhalten
- keine negativen Werte
- keine doppelten Intervalle
- fehlende Messwerte müssen markiert werden
- geschätzte Werte müssen markiert werden
- Abrechnungsfreigabe erst nach Plausibilitätsprüfung

---

## 13. REST API V1

### 13.1 API-Gruppen

```text
/api/health
/api/auth
/api/dashboard
/api/participants
/api/meters
/api/devices
/api/measurements
/api/control-decisions
/api/settlement
/api/reports
/api/alarms
/api/config
/api/admin
```

### 13.2 Health API

```http
GET /api/health
GET /api/health/services
GET /api/health/database
GET /api/health/devices
GET /api/version
```

### 13.3 Auth API

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### 13.4 Dashboard API

```http
GET /api/dashboard/operator
GET /api/dashboard/resident/{participantId}
GET /api/dashboard/ops
```

### 13.5 Participant API

```http
GET    /api/participants
GET    /api/participants/{id}
POST   /api/participants
PUT    /api/participants/{id}
DELETE /api/participants/{id}
GET    /api/participants/{id}/energy-summary?from=&to=
```

### 13.6 Meter API

```http
GET /api/meters
GET /api/meters/{id}
GET /api/meters/{id}/latest
GET /api/meters/{id}/timeseries?from=&to=
GET /api/meters/status
```

### 13.7 Device API

```http
GET  /api/devices
GET  /api/devices/inverter/status
GET  /api/devices/battery/status
POST /api/devices/inverter/setpoint
```

Direkter Schreibzugriff auf Wechselrichter-Sollwerte ist nur für Admin/Ops zulässig und im Normalbetrieb nicht für Bewohner oder Betreiber sichtbar.

### 13.8 Control Decision API

```http
GET /api/control-decisions/latest
GET /api/control-decisions?from=&to=&status=
GET /api/control-decisions/{id}
```

### 13.9 Settlement API

```http
POST /api/settlement/run?from=&to=
GET  /api/settlement/intervals?from=&to=
GET  /api/settlement/participants/{participantId}?month=
POST /api/settlement/approve
GET  /api/settlement/plausibility?month=
```

### 13.10 Report API

```http
GET  /api/reports
POST /api/reports/monthly
GET  /api/reports/{id}/download
GET  /api/reports/customer/{participantId}/monthly?month=
GET  /api/reports/operator/monthly?month=
GET  /api/reports/export/csv?from=&to=
POST /api/reports/diagnostics
```

### 13.11 Alarm API

```http
GET  /api/alarms
GET  /api/alarms/active
POST /api/alarms/{id}/ack
POST /api/alarms/{id}/close
```

### 13.12 Config API

```http
GET  /api/config
PUT  /api/config/site
PUT  /api/config/meters
PUT  /api/config/inverter
PUT  /api/config/battery
PUT  /api/config/tariffs
GET  /api/config/versions
```

---

## 14. UI V1

### 14.1 Bewohneransicht B+

Ziel: einfach und verständlich.

Hauptbegriffe:

- Mein Verbrauch
- Lokaler Gemeinschaftsstrom
- Ergänzung aus dem öffentlichen Netz
- Lokaler Deckungsgrad
- Mein Vorteil

Dashboard-Kacheln:

| Kachel | Beispiel |
|---|---:|
| Verbrauch heute | 8,4 kWh |
| lokaler Gemeinschaftsstrom | 3,1 kWh |
| Ergänzung aus Netz | 5,3 kWh |
| lokaler Deckungsgrad | 37 % |
| geschätzter Vorteil | 1,42 € |

Visualisierung:

```text
Mein Strommix:
[ Lokaler Gemeinschaftsstrom 37 % ][ Netzstrom 63 % ]
```

### 14.2 Betreiberdashboard

Kacheln:

| Kachel | Inhalt |
|---|---|
| Anlagenstatus | OK / Warnung / Fehler |
| PV-Erzeugung heute | kWh |
| Batterie SOC | % |
| B+ Verbrauch heute | kWh |
| B- Verbrauch heute | kWh |
| Lokaler Deckungsgrad B+ | % |
| offene Alarme | Anzahl |
| offene Abrechnung | Monat |

### 14.3 Betreiberseiten

```text
/operator/dashboard
/operator/participants
/operator/devices
/operator/settlement
/operator/reports
/operator/alarms
```

### 14.4 Solarel Operations

```text
/solarel/sites
/solarel/site/{id}
/solarel/alarms
/solarel/tickets
```

Für V1 kann diese Ansicht zunächst auf eine Anlage beschränkt sein. Die Struktur soll aber mehranlagenfähig gedacht werden.

### 14.5 Sailer Engineering Ops Console

```text
/ops/health
/ops/services
/ops/logs
/ops/rules
/ops/diagnostics
/ops/config
```

Wichtigster Screen:

```text
Regelentscheidung im Detail
```

Beispielanzeige:

```text
Zeitpunkt: 2026-06-05 18:15:03
B+ Verbrauch:              1.000 W
B- Verbrauch:                500 W
Batterie SOC:                 48 %
Batterie verfügbar:           ja
Regelgrenze:               5.000 W
Sollwert berechnet:        1.000 W
Sollwert gesendet:         1.000 W
Wechselrichter Istwert:      980 W
Status:                    OK
```

### 14.6 Admin UI

```text
/admin/users
/admin/roles
/admin/sites
/admin/devices
/admin/tariffs
/admin/api-keys
```

---

## 15. Reports und Exporte

### 15.1 Bewohner-Monatsreport

Inhalt:

- Zeitraum
- Teilnehmer
- Zählernummer
- Verbrauch gesamt
- lokaler Gemeinschaftsstrom
- Ergänzung aus öffentlichem Netz
- lokaler Deckungsgrad
- Tarif lokaler Anteil
- Kosten lokaler Anteil
- geschätzter Vorteil
- Erläuterung der Berechnung
- optional CSV-Detailnachweis

### 15.2 Betreiber-Monatsreport

Inhalt:

- PV-Erzeugung
- Batterieladung
- Batterieentladung
- B+ Verbrauch
- B- Verbrauch
- lokaler Deckungsgrad
- Netzbezug
- Einspeisung
- Speicherstatus
- Anlagenverfügbarkeit
- Messdatenqualität
- Alarme
- Plausibilitätsstatus

### 15.3 Abrechnungsreport

Inhalt:

- Teilnehmerliste
- Verbrauch je Teilnehmer
- lokaler Anteil je Teilnehmer
- Netzanteil je Teilnehmer
- Tarif
- Betrag
- Freigabestatus
- Freigabezeitpunkt
- Freigabeuser

### 15.4 Plausibilitätsreport

Prüfungen:

- Sind alle 15-Minuten-Intervalle vorhanden?
- Sind alle Smart-Meter-Werte gültig?
- Wurde B- kein lokaler Strom zugeordnet?
- Ist die Summe lokaler Zuordnung kleiner oder gleich lokaler Energie?
- Gibt es negative Werte?
- Gibt es Kommunikationsausfälle?
- Gibt es manuelle Korrekturen?

### 15.5 Auditreport

Inhalt:

- Konfigurationsänderungen
- Benutzeraktionen
- Abrechnungsfreigaben
- Reportexporte
- Regelalgorithmus-Version
- Config-Version
- relevante Systemereignisse

### 15.6 Diagnoseexport

ZIP-Datei mit:

```text
system_info.json
docker_status.txt
service_health.json
latest_logs/
config_snapshot/
database_summary.json
recent_control_decisions.csv
recent_alarms.csv
```

---

## 16. Import- und Exportfunktionen

### 16.1 Importe V1

| Import | Format |
|---|---|
| Teilnehmerliste | CSV / JSON |
| Smart-Meter-Stammdaten | CSV / JSON |
| Tarifdaten | CSV / JSON |
| Wechselrichterkonfiguration | JSON |
| Demo-Szenarien | JSON |
| manuelle Korrekturen | CSV / JSON |

### 16.2 Exporte V1

| Export | Format |
|---|---|
| Bewohnerreport | PDF |
| Betreiberreport | PDF |
| Abrechnungsdaten | CSV |
| 15-Minuten-Detailnachweis | CSV |
| technische Messwerte | CSV / JSON |
| Auditlog | CSV / JSON |
| Diagnosepaket | ZIP |

---

## 17. Security

### 17.1 Security MVP V1

V1 basiert auf:

```text
SSH + Passwort-Login
lokales Netzwerk
NGINX als lokaler Zugriffspunkt
keine öffentliche Exposition
```

Mindestmaßnahmen:

- starkes SSH-Passwort
- separater Admin-User
- Firewall aktiv
- nur Ports 22, 80, optional 443 offen
- Docker-Ports nicht unnötig nach außen freigeben
- regelmäßige Backups
- Benutzerrollen in Web-UI
- Auditlog für Adminaktionen

### 17.2 Security V2

Lokaler Zugriff:

```text
[ Lokales Netzwerk / Bewohner ]
        ── blockiert ohne Zertifikat ──>
[ NGINX: mTLS ]
```

Remote Admin:

```text
[ Remote-Admin / Handwerker / Verwaltung ]
        ── sicherer Tunnel ──>
[ WireGuard / Tailscale ]
```

Ziel:

| Zugriff | Mechanismus |
|---|---|
| Bewohner lokal | mTLS |
| Betreiber lokal | mTLS + Rolle |
| Solarel Operator | VPN + Rolle |
| Sailer Engineering | VPN + Admin/Ops |
| Externe Prüfer | read-only Export / read-only Zugang |

---

## 18. Simulationsmodus

### 18.1 Ziel

Der Simulationsmodus ist verpflichtender Bestandteil des MVP, damit Entwicklung, Demo und Tests ohne echte PV-Anlage möglich sind.

Aktivierung:

```text
SIMULATION_MODE=true
```

### 18.2 Simulierbare Komponenten

- Smart Meter
- PV-Erzeugung
- Batterie SOC
- Wechselrichter
- B+ Lastprofile
- B- Lastprofile
- Kommunikationsfehler
- Winter-/Sommerfälle

### 18.3 Simulationsszenarien

```text
summer_high_pv
winter_20_percent_local_coverage
bplus_load_step
bminus_load_step
smart_meter_offline
inverter_offline
battery_soc_low
communication_timeout
```

### 18.4 Zweck

- Demo für Solarel
- Entwicklung ohne Hardware
- Test der Abrechnung
- Test der Visualisierung
- Test der Alarme
- Test der Regelentscheidungen
- reproduzierbare Fehlerfälle

---

## 19. Deployment

### 19.1 Installation

Zielsystem:

- Ubuntu Server oder Debian
- Docker
- Docker Compose
- Git
- SSH Zugang

Installationsschritte:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin

git clone <repository-url> ella-edge-ems
cd ella-edge-ems

cp .env.example .env
cp config/site.example.json config/site.json
cp config/meters.example.json config/meters.json
cp config/inverter.example.json config/inverter.json
cp config/battery.example.json config/battery.json
cp config/tariffs.example.json config/tariffs.json

docker compose build
docker compose up -d
```

### 19.2 Update

```bash
cd ella-edge-ems
git pull
docker compose build
docker compose up -d
```

Später:

- signierte Releases
- Rollback
- Update über Admin UI
- Version Pinning

### 19.3 Backup

Zu sichern:

```text
/data/ella-edge.db
/config/*.json
/reports/*
wichtige Logs optional
```

Backup-Datei:

```text
backup_ella_edge_<SITE_ID>_<YYYYMMDD_HHMM>.zip
```

### 19.4 Restore

Restore muss sicherstellen:

- Container stoppen
- alte Daten sichern
- Backup entpacken
- Dateirechte setzen
- Container starten
- Health Check ausführen

---

## 20. Monitoring und Operations

### 20.1 Health Checks

Zu überwachen:

- Edge-System erreichbar
- Container laufen
- Backend API erreichbar
- SQLite erreichbar
- letzter Smart-Meter-Wert aktuell
- Wechselrichter erreichbar
- Batterie erreichbar
- letzte Regelentscheidung OK
- freier Speicherplatz ausreichend
- CPU/RAM im Normalbereich

### 20.2 Alarme

MVP-Alarme:

```text
SMART_METER_OFFLINE
INVERTER_OFFLINE
BATTERY_OFFLINE
BATTERY_SOC_LOW
CONTROL_DEVIATION_HIGH
NO_VALID_BPLUS_DATA
DATABASE_ERROR
DISK_SPACE_LOW
SETTLEMENT_INCOMPLETE
REPORT_GENERATION_FAILED
```

### 20.3 Eskalation

V1-Eskalationsmodell:

| Level | Zuständig | Aufgabe |
|---|---|---|
| 1st Level | Solarel | einfache Störungen, Vor-Ort-Prüfung |
| 2nd Level | Sailer Engineering | Software, Datenbank, Regelung, Updates |
| Hersteller | WR/Batterie/Zähler | Geräte- und Firmwareprobleme |

---

## 21. MVP-Abgrenzung

### 21.1 Muss in V1

- lokaler Edge-Betrieb
- Docker Compose Deployment
- React/Tailwind Frontend
- NGINX
- Bun/TypeScript Backend API
- Python Services
- SQLite Datenbank
- Teilnehmerverwaltung B+/B-
- Smart-Meter-Auslesung oder Simulation
- Wechselrichtersteuerung oder Simulation
- B+ Leistungsaggregation
- Regelentscheidungsprotokoll
- 15-Minuten-Settlement
- Bewohner-Strommix-Darstellung
- Betreiberdashboard
- Alarmübersicht
- Monatsreport PDF/CSV
- Diagnoseexport
- Backup/Restore
- Git-Versionierung

### 21.2 Nicht zwingend in V1

- KI-Optimierung
- Strombörsenoptimierung
- EVU-Vollintegration
- Netzbetreiber-Liveintegration
- automatische Zahlungsabwicklung
- zentrale Cloud-Fleet-Verwaltung
- komplexe Mandantenfähigkeit
- vollautomatische Zertifikatsverwaltung
- Bewohner-Smartphone-App
- Prometheus/Grafana/Loki
- PostgreSQL/TimescaleDB produktiv

### 21.3 V2-Kandidaten

- WireGuard / Tailscale Remote-Zugang
- NGINX mTLS
- PostgreSQL oder TimescaleDB
- RabbitMQ produktiv
- zentrale Solarel-Fleet-Ansicht
- Mandantenfähigkeit
- KI-Prognose
- dynamische Speicheroptimierung
- Strompreis-/Börsenpreis-Integration
- EVU-/Netzbetreiber-Schnittstellen
- automatische Abrechnungsschnittstelle

---

## 22. Entwicklungsreihenfolge

### Phase 1: Repository und Basislaufzeit

- Monorepo anlegen
- Docker Compose erstellen
- NGINX starten
- React Demo UI starten
- Backend API `/api/health`
- SQLite Initialisierung

### Phase 2: Simulation

- Demo-Site anlegen
- Teilnehmer B+/B- anlegen
- Smart-Meter-Simulator
- Wechselrichter-/Batteriesimulator
- einfache Zeitreihendaten erzeugen

### Phase 3: Regelung

- B+ Summe berechnen
- B- Summe berechnen
- Sollwert berechnen
- Hysterese
- Limits
- ControlDecision speichern

### Phase 4: UI MVP

- Betreiberdashboard
- Bewohner-Strommix
- Geräteübersicht
- Alarmübersicht
- Regelentscheidungsdetail

### Phase 5: Settlement

- 15-Minuten-Intervalle
- lokale Zuordnung
- Netzanteil
- Plausibilitätsprüfung
- Abrechnungsfreigabe

### Phase 6: Reports

- Bewohnerreport
- Betreiberreport
- CSV Detailnachweis
- Diagnoseexport

### Phase 7: Hardwareintegration

- echter Smart Meter
- echter Wechselrichter
- Modbus TCP/RTU
- Sicherheitslimits
- Failsafe-Test

### Phase 8: Pilotbetrieb

- Installation am Edge-System
- Remote-Login
- Logging
- Backup/Restore
- Solarel/Sailer Betriebsprozess

---

## 23. Akzeptanzkriterien MVP

Der MVP gilt als erfolgreich, wenn folgende Punkte erfüllt sind:

1. Das System läuft lokal auf einem Edge-System im Docker-Compose-Verbund.
2. Die UI ist über NGINX erreichbar.
3. B+ und B- Teilnehmer können verwaltet werden.
4. Smart-Meter-Werte können simuliert oder real eingelesen werden.
5. Das System berechnet die aktuelle B+ Leistung.
6. Das System erzeugt daraus einen Wechselrichter-Sollwert.
7. Jede Regelentscheidung wird nachvollziehbar gespeichert.
8. Der Winterfall mit nur 20 % lokaler Deckung wird korrekt im Settlement abgebildet.
9. B- Teilnehmer erhalten keine lokale Energiezuordnung.
10. Bewohner sehen ihren Strommix verständlich.
11. Betreiber können Monatsdaten plausibilisieren.
12. Reports können als PDF/CSV erzeugt werden.
13. Alarme werden angezeigt und quittiert.
14. Ein Diagnosepaket kann erzeugt werden.
15. Backup und Restore sind dokumentiert.
16. Die Version des Systems ist über Git nachvollziehbar.

---

## 24. Zentrale Produktaussage

Ella Edge EMS V1 ist kein normales PV-Monitoring und keine reine Wechselrichtersteuerung.

Die Produktaussage lautet:

```text
Ella Edge EMS ist ein lokales Betriebs-, Abrechnungs- und Nachweissystem für teilnehmerbezogene PV-/Speichernutzung in Mehrparteienanlagen.
```

Noch kürzer:

```text
Ella Edge macht gemeinschaftliche PV- und Speicheranlagen in Mehrparteienhäusern steuerbar, abrechenbar und nachvollziehbar.
```

---

## 25. Wichtigste technische Entscheidung

Die wichtigste technische Entscheidung für V1 lautet:

```text
Zuerst lokal, deterministisch, nachvollziehbar und containerisiert.
Erst danach Cloud, KI, Fleet Management und komplexe Integrationen.
```

Damit bleibt der MVP beherrschbar und gleichzeitig professionell erweiterbar.

---

## 26. Nächster konkreter Umsetzungsschritt

Der nächste sinnvolle Schritt ist die Erstellung des Repository-Skeletons:

```text
ella-edge-ems/
├── docker-compose.yml
├── frontend/
├── backend-api/
├── services/
├── database/
├── nginx/
├── config/
├── scripts/
└── docs/
```

Danach wird zuerst ein lauffähiger Simulationsmodus implementiert:

```text
Smart-Meter-Simulation → B+ Aggregation → Sollwertsimulation → Dashboard → 15-Minuten-Settlement
```

Erst wenn dieser Pfad vollständig funktioniert, erfolgt die Integration echter Smart Meter und echter Wechselrichter.

---

## 27. Schlussbemerkung

Diese Spezifikation ist die Arbeitsgrundlage für die Implementierung von Ella Edge EMS V1.

Sie verbindet:

- fachliche Energiegemeinschaftslogik
- lokale Edge-Architektur
- containerisierte Softwaremodule
- nachvollziehbare Regelentscheidungen
- 15-Minuten-Abrechnung
- rollenbasierte UI
- Betreiber- und Operationsfähigkeit
- klare Erweiterbarkeit zu V2

Damit entsteht ein MVP, der nicht nur demonstriert, sondern tatsächlich als Pilotanlage betrieben werden kann.
