-- Ella Edge EMS V1 – SQLite Schema
-- All timestamps stored as UTC ISO-8601 strings

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Sites ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    address     TEXT,
    timezone    TEXT NOT NULL DEFAULT 'Europe/Vienna',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Buildings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buildings (
    id          TEXT PRIMARY KEY,
    site_id     TEXT NOT NULL REFERENCES sites(id),
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Apartments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apartments (
    id          TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id),
    site_id     TEXT NOT NULL REFERENCES sites(id),
    unit_label  TEXT NOT NULL,
    floor       INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Meters ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meters (
    id              TEXT PRIMARY KEY,
    site_id         TEXT NOT NULL REFERENCES sites(id),
    apartment_id    TEXT REFERENCES apartments(id),
    serial_number   TEXT,
    cid             TEXT UNIQUE,  -- SmartMeter hardware custom-ID (maps HW device → meter)
    meter_type      TEXT NOT NULL DEFAULT 'SMART_METER',
    protocol        TEXT NOT NULL DEFAULT 'SIMULATION',  -- SIMULATION | MODBUS_TCP | MODBUS_RTU
    address         TEXT,   -- IP:port or serial device
    modbus_unit_id  INTEGER,
    max_load_w      REAL    NOT NULL DEFAULT 4000,  -- simulation slider upper bound
    push_interval_s INTEGER NOT NULL DEFAULT 10,   -- expected push interval (seconds)
    push_timeout_s  INTEGER NOT NULL DEFAULT 60,   -- watchdog writes 0W after this silence
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Participants ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participants (
    id                  TEXT PRIMARY KEY,
    site_id             TEXT NOT NULL REFERENCES sites(id),
    apartment_id        TEXT NOT NULL REFERENCES apartments(id),
    meter_id            TEXT REFERENCES meters(id),
    tariff_id           TEXT REFERENCES tariffs(id),
    display_name        TEXT NOT NULL,
    participant_status  TEXT NOT NULL CHECK(participant_status IN ('BPLUS','BMINUS')),
    valid_from          TEXT NOT NULL,
    valid_to            TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Devices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
    id              TEXT PRIMARY KEY,
    site_id         TEXT NOT NULL REFERENCES sites(id),
    device_type     TEXT NOT NULL,  -- INVERTER | BATTERY | GRID_METER | PV_METER
    name            TEXT NOT NULL,
    manufacturer    TEXT,
    model           TEXT,
    protocol        TEXT NOT NULL DEFAULT 'SIMULATION',
    address         TEXT,
    modbus_unit_id  INTEGER,
    max_power_w     REAL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Measurements ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS measurements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id             TEXT NOT NULL REFERENCES sites(id),
    meter_id            TEXT NOT NULL REFERENCES meters(id),
    timestamp_utc       TEXT NOT NULL,
    active_power_w      REAL,
    energy_import_wh    REAL,
    energy_export_wh    REAL,
    voltage_v           REAL,
    current_a           REAL,
    power_factor        REAL,
    quality_flag        TEXT NOT NULL DEFAULT 'OK'
                            CHECK(quality_flag IN ('OK','STALE','ESTIMATED','INVALID','COMM_ERROR')),
    source              TEXT NOT NULL DEFAULT 'SIMULATION',
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_measurements_meter_time
    ON measurements(meter_id, timestamp_utc DESC);

-- ── Power States ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS power_states (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id         TEXT NOT NULL REFERENCES sites(id),
    timestamp_utc   TEXT NOT NULL,
    bplus_power_w   REAL NOT NULL DEFAULT 0,
    bminus_power_w  REAL NOT NULL DEFAULT 0,
    total_power_w   REAL NOT NULL DEFAULT 0,
    pv_power_w      REAL,
    battery_soc_pct REAL,
    valid_meter_count   INTEGER NOT NULL DEFAULT 0,
    invalid_meter_count INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_power_states_site_time
    ON power_states(site_id, timestamp_utc DESC);

-- ── Control Decisions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS control_decisions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id                 TEXT NOT NULL REFERENCES sites(id),
    timestamp_utc           TEXT NOT NULL,
    bplus_power_w           REAL NOT NULL DEFAULT 0,
    bminus_power_w          REAL NOT NULL DEFAULT 0,
    total_power_w           REAL NOT NULL DEFAULT 0,
    battery_soc_percent     REAL,
    pv_power_w              REAL,
    max_allowed_discharge_w REAL,
    calculated_setpoint_w   REAL NOT NULL DEFAULT 0,
    sent_setpoint_w         REAL,
    actual_inverter_power_w REAL,
    decision_status         TEXT NOT NULL DEFAULT 'OK',
    reason                  TEXT NOT NULL,
    algorithm_version       TEXT NOT NULL DEFAULT 'v1.0',
    config_version_id       TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_control_decisions_site_time
    ON control_decisions(site_id, timestamp_utc DESC);

-- ── Inverter Setpoints ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inverter_setpoints (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id             TEXT NOT NULL REFERENCES sites(id),
    device_id           TEXT NOT NULL REFERENCES devices(id),
    timestamp_utc       TEXT NOT NULL,
    setpoint_w          REAL NOT NULL,
    ack_power_w         REAL,
    send_status         TEXT NOT NULL DEFAULT 'PENDING',
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Settlement Intervals ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlement_intervals (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id                 TEXT NOT NULL REFERENCES sites(id),
    interval_start_utc      TEXT NOT NULL,
    interval_end_utc        TEXT NOT NULL,
    bplus_consumption_wh    REAL NOT NULL DEFAULT 0,
    bminus_consumption_wh   REAL NOT NULL DEFAULT 0,
    local_energy_available_wh   REAL NOT NULL DEFAULT 0,
    local_allocation_factor REAL NOT NULL DEFAULT 0,
    grid_energy_bplus_wh    REAL NOT NULL DEFAULT 0,
    settlement_status       TEXT NOT NULL DEFAULT 'OPEN'
                                CHECK(settlement_status IN ('OPEN','CALCULATED','APPROVED','LOCKED')),
    plausibility_status     TEXT NOT NULL DEFAULT 'PENDING'
                                CHECK(plausibility_status IN ('PENDING','OK','WARNING','FAILED')),
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at             TEXT,
    approved_by             TEXT,
    UNIQUE(site_id, interval_start_utc)
);

-- ── Settlement Participant Allocations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlement_participant_allocations (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    settlement_interval_id  INTEGER NOT NULL REFERENCES settlement_intervals(id),
    participant_id          TEXT NOT NULL REFERENCES participants(id),
    consumption_wh          REAL NOT NULL DEFAULT 0,
    local_energy_wh         REAL NOT NULL DEFAULT 0,
    grid_energy_wh          REAL NOT NULL DEFAULT 0,
    local_coverage_percent  REAL NOT NULL DEFAULT 0,
    tariff_local_amount     REAL,
    tariff_grid_amount      REAL,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(settlement_interval_id, participant_id)
);

-- ── Tariffs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tariffs (
    id              TEXT PRIMARY KEY,
    site_id         TEXT NOT NULL REFERENCES sites(id),
    name            TEXT NOT NULL,
    local_price_ct_per_kwh  REAL NOT NULL DEFAULT 0,
    grid_price_ct_per_kwh   REAL NOT NULL DEFAULT 0,
    service_fee_ct_per_kwh  REAL NOT NULL DEFAULT 0,
    valid_from      TEXT NOT NULL,
    valid_to        TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Invoices ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id              TEXT PRIMARY KEY,
    site_id         TEXT NOT NULL REFERENCES sites(id),
    participant_id  TEXT NOT NULL REFERENCES participants(id),
    period_from     TEXT NOT NULL,
    period_to       TEXT NOT NULL,
    total_kwh       REAL NOT NULL DEFAULT 0,
    local_kwh       REAL NOT NULL DEFAULT 0,
    grid_kwh        REAL NOT NULL DEFAULT 0,
    total_amount    REAL NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'DRAFT',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at     TEXT,
    approved_by     TEXT
);

-- ── Reports ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id              TEXT PRIMARY KEY,
    site_id         TEXT NOT NULL REFERENCES sites(id),
    report_type     TEXT NOT NULL,
    period_from     TEXT,
    period_to       TEXT,
    participant_id  TEXT REFERENCES participants(id),
    file_path       TEXT,
    file_format     TEXT NOT NULL DEFAULT 'PDF',
    status          TEXT NOT NULL DEFAULT 'PENDING',
    created_by      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT,
    params          TEXT
);

-- ── Alarms ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alarms (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id         TEXT NOT NULL REFERENCES sites(id),
    alarm_code      TEXT NOT NULL,
    alarm_class     TEXT NOT NULL DEFAULT 'WARNING'
                        CHECK(alarm_class IN ('INFO','WARNING','ERROR','CRITICAL')),
    message         TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       TEXT,
    status          TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK(status IN ('ACTIVE','ACKNOWLEDGED','CLOSED')),
    triggered_at    TEXT NOT NULL DEFAULT (datetime('now')),
    acked_at        TEXT,
    acked_by        TEXT,
    closed_at       TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alarms_site_status
    ON alarms(site_id, status);

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    email           TEXT UNIQUE,
    password_hash   TEXT NOT NULL,
    display_name    TEXT,
    participant_id  TEXT REFERENCES participants(id),
    is_active       INTEGER NOT NULL DEFAULT 1,
    last_login_at   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Roles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id     TEXT NOT NULL REFERENCES users(id),
    role_id     TEXT NOT NULL REFERENCES roles(id),
    site_id     TEXT REFERENCES sites(id),
    PRIMARY KEY (user_id, role_id, site_id)
);

-- ── Config Versions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_versions (
    id          TEXT PRIMARY KEY,
    site_id     TEXT NOT NULL REFERENCES sites(id),
    version     TEXT NOT NULL,
    config_json TEXT NOT NULL,
    changed_by  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Audit Events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp_utc   TEXT NOT NULL DEFAULT (datetime('now')),
    user_id         TEXT REFERENCES users(id),
    event_type      TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       TEXT,
    old_value_json  TEXT,
    new_value_json  TEXT,
    reason          TEXT,
    source_ip       TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── SmartMeter Push Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smartmeter_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    cid         TEXT,
    pact_str    TEXT,
    ldt         TEXT,
    meter_id    TEXT,   -- resolved meter (NULL on error)
    status      TEXT    NOT NULL DEFAULT 'OK' CHECK(status IN ('OK','ERROR')),
    error_msg   TEXT,
    source_ip   TEXT
);

CREATE INDEX IF NOT EXISTS idx_smartmeter_log_received
    ON smartmeter_log(received_at DESC);

-- ── System Logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
    service     TEXT NOT NULL,
    level       TEXT NOT NULL DEFAULT 'INFO',
    message     TEXT NOT NULL,
    details_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_logs_service_time
    ON system_logs(service, timestamp DESC);

-- ── Seed: Roles ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO roles(id, name, description) VALUES
    ('role-admin',    'admin',    'Full system administration'),
    ('role-operator', 'operator', 'Site operator / Hausverwaltung'),
    ('role-resident', 'resident', 'B+ resident portal access'),
    ('role-ops',      'ops',      'Sailer Engineering operations'),
    ('role-solarel',  'solarel',  'Solarel 1st-level support');
