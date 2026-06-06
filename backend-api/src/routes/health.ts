import { Elysia } from 'elysia'
import { getDb } from '../db/init'

const VERSION = '1.0.0'
const START_TIME = Date.now()

export const healthRoutes = new Elysia()
  .get('/api/health', () => ({
    status: 'ok',
    service: 'ella-backend-api',
    version: VERSION,
    uptime_s: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    simulation_mode: process.env.SIMULATION_MODE === 'true',
  }))

  .get('/api/health/database', () => {
    try {
      const db = getDb()
      const row = db.prepare("SELECT datetime('now') as now").get() as { now: string }
      return { status: 'ok', db_time: row.now }
    } catch (e) {
      return { status: 'error', message: String(e) }
    }
  })

  .get('/api/version', () => ({
    version: VERSION,
    service: 'ella-backend-api',
    built_at: new Date().toISOString(),
  }))
