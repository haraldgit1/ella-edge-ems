import { Database } from 'bun:sqlite'
import { readFileSync } from 'fs'

const DB_PATH = process.env.ELLA_DB_PATH ?? '/data/ella-edge.db'
const SCHEMA_PATH = '/database/schema.sql'
const SEED_PATH = '/database/seed/demo_seed.sql'

let _db: Database | null = null

export function getDb(): Database {
  if (!_db) {
    // timeout: wait up to 10s if other processes hold the lock
    _db = new Database(DB_PATH, { create: true, timeout: 10000 })
    try { _db.exec('PRAGMA journal_mode = WAL') } catch { /* already set */ }
    _db.exec('PRAGMA foreign_keys = ON')
    _db.exec('PRAGMA busy_timeout = 5000')
  }
  return _db
}

export async function initDatabase(): Promise<void> {
  const db = getDb()

  try {
    const schema = readFileSync(SCHEMA_PATH, 'utf-8')
    db.exec(schema)
    console.log('Database schema applied')
  } catch (e) {
    console.warn('Schema file not found at', SCHEMA_PATH, '–', String(e).split('\n')[0])
  }

  // Migration: add cid column to meters for existing DBs
  try {
    db.run('ALTER TABLE meters ADD COLUMN cid TEXT')
    console.log('Migration: added cid to meters')
  } catch { /* already exists */ }
  try {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_meters_cid ON meters(cid) WHERE cid IS NOT NULL')
  } catch { /* ignore */ }

  // Migration: add max_load_w to meters (simulation slider upper bound)
  try {
    db.run('ALTER TABLE meters ADD COLUMN max_load_w REAL NOT NULL DEFAULT 4000')
    console.log('Migration: added max_load_w to meters')
  } catch { /* already exists */ }

  // Migration: add push_interval_s and push_timeout_s to meters
  try {
    db.run('ALTER TABLE meters ADD COLUMN push_interval_s INTEGER NOT NULL DEFAULT 10')
    console.log('Migration: added push_interval_s to meters')
  } catch { /* already exists */ }
  try {
    db.run('ALTER TABLE meters ADD COLUMN push_timeout_s INTEGER NOT NULL DEFAULT 60')
    console.log('Migration: added push_timeout_s to meters')
  } catch { /* already exists */ }

  // Migration: index for overlay query performance (created_at alignment)
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_measurements_meter_created ON measurements(meter_id, created_at DESC)')
  } catch { /* ignore */ }

  // Migration: create smartmeter_log table
  db.run(`CREATE TABLE IF NOT EXISTS smartmeter_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    cid         TEXT,
    pact_str    TEXT,
    ldt         TEXT,
    meter_id    TEXT,
    status      TEXT    NOT NULL DEFAULT 'OK' CHECK(status IN ('OK','ERROR')),
    error_msg   TEXT,
    source_ip   TEXT
  )`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_smartmeter_log_received
    ON smartmeter_log(received_at DESC)`)

  try {
    const seed = readFileSync(SEED_PATH, 'utf-8')
    db.exec(seed)
    console.log('Demo seed applied')
  } catch (e) {
    console.warn('Seed file not found at', SEED_PATH, '–', String(e).split('\n')[0])
  }
}
