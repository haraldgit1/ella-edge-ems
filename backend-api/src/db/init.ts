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
  // SQLite does not allow UNIQUE on ALTER TABLE ADD COLUMN — use a separate index
  try {
    db.run('ALTER TABLE meters ADD COLUMN cid TEXT')
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_meters_cid ON meters(cid) WHERE cid IS NOT NULL')
    console.log('Migration: added cid column to meters')
  } catch { /* column already exists — expected on most starts */ }
  // Ensure index exists even when column was already added previously
  try {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_meters_cid ON meters(cid) WHERE cid IS NOT NULL')
  } catch { /* ignore */ }

  try {
    const seed = readFileSync(SEED_PATH, 'utf-8')
    db.exec(seed)
    console.log('Demo seed applied')
  } catch (e) {
    console.warn('Seed file not found at', SEED_PATH, '–', String(e).split('\n')[0])
  }
}
