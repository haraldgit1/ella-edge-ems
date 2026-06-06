import { Elysia } from 'elysia'
import { getDb } from '../db/init'

export const meterRoutes = new Elysia({ prefix: '/api/meters' })
  .get('/', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM meters ORDER BY id').all()
  })

  .get('/status', () => {
    const db = getDb()
    return db.prepare(`
      SELECT m.id, m.serial_number, m.protocol,
             meas.timestamp_utc as last_reading,
             meas.active_power_w,
             meas.quality_flag
      FROM meters m
      LEFT JOIN measurements meas ON meas.id = (
          SELECT id FROM measurements WHERE meter_id = m.id
          ORDER BY timestamp_utc DESC LIMIT 1
      )
      WHERE m.is_active = 1
    `).all()
  })

  .get('/:id/latest', ({ params }) => {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM measurements WHERE meter_id = ? ORDER BY timestamp_utc DESC LIMIT 1'
    ).get(params.id) ?? { error: 'No data' }
  })
