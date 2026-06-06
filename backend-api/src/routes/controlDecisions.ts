import { Elysia } from 'elysia'
import { getDb } from '../db/init'

export const controlDecisionRoutes = new Elysia({ prefix: '/api/control-decisions' })
  .get('/latest', () => {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM control_decisions ORDER BY timestamp_utc DESC LIMIT 1'
    ).get() ?? { error: 'No data' }
  })

  .get('/', ({ query }) => {
    const db = getDb()
    const limit = Math.min(parseInt(String(query.limit ?? '50')), 500)
    return db.prepare(
      'SELECT * FROM control_decisions ORDER BY timestamp_utc DESC LIMIT ?'
    ).all(limit)
  })
