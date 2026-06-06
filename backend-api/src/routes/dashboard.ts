import { Elysia } from 'elysia'
import { getDb } from '../db/init'

export const dashboardRoutes = new Elysia({ prefix: '/api/dashboard' })
  .get('/operator', () => {
    const db = getDb()
    const ps = db.prepare(
      "SELECT * FROM power_states ORDER BY timestamp_utc DESC LIMIT 1"
    ).get() as any

    const activeAlarms = (db.prepare(
      "SELECT COUNT(*) as count FROM alarms WHERE status = 'ACTIVE'"
    ).get() as any)?.count ?? 0

    return {
      power_state: ps ?? null,
      active_alarms: activeAlarms,
      timestamp: new Date().toISOString(),
    }
  })
