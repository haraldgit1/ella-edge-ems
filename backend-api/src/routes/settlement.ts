import { Elysia } from 'elysia'
import { getDb } from '../db/init'

export const settlementRoutes = new Elysia({ prefix: '/api/settlement' })
  .get('/intervals', ({ query }) => {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM settlement_intervals ORDER BY interval_start_utc DESC LIMIT 100'
    ).all()
  })

  .get('/plausibility', ({ query }) => {
    // TODO: full plausibility report
    return { status: 'not_implemented' }
  })
