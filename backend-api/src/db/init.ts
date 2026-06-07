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

  try {
    const seed = readFileSync(SEED_PATH, 'utf-8')
    db.exec(seed)
    console.log('Demo seed applied')
  } catch (e) {
    console.warn('Seed file not found at', SEED_PATH, '–', String(e).split('\n')[0])
  }
}
