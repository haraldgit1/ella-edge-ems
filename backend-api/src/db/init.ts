import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

const DB_PATH = process.env.ELLA_DB_PATH ?? '/data/ella-edge.db'
const SCHEMA_PATH = '/database/schema.sql'
const SEED_PATH = '/database/seed/demo_seed.sql'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
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
    console.warn('Schema file not found at', SCHEMA_PATH, '– skipping')
  }

  try {
    const seed = readFileSync(SEED_PATH, 'utf-8')
    db.exec(seed)
    console.log('Demo seed applied')
  } catch (e) {
    console.warn('Seed file not found at', SEED_PATH, '– skipping')
  }
}
