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
      SELECT m.id, m.serial_number, m.cid, m.protocol,
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

  .get('/:id/history', ({ params, query }) => {
    const db      = getDb()
    const rangeRaw = parseInt((query as any).range ?? '1800')
    const rangeS   = Math.min(86400, Math.max(300, isNaN(rangeRaw) ? 1800 : rangeRaw))
    const bucketS  = Math.max(5, Math.round(rangeS / 120))
    return db.prepare(`
      SELECT
        datetime(
          CAST(strftime('%s', timestamp_utc) AS INTEGER) / ${bucketS} * ${bucketS},
          'unixepoch'
        ) AS timestamp_utc,
        ROUND(AVG(active_power_w), 1) AS power_w
      FROM measurements
      WHERE meter_id = ?
        AND CAST(strftime('%s', timestamp_utc) AS INTEGER) >= strftime('%s', 'now') - ${rangeS}
      GROUP BY CAST(strftime('%s', timestamp_utc) AS INTEGER) / ${bucketS}
      ORDER BY timestamp_utc ASC
    `).all(params.id) as any[]
  })

  .get('/:id/latest', ({ params }) => {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM measurements WHERE meter_id = ? ORDER BY timestamp_utc DESC LIMIT 1'
    ).get(params.id) ?? { error: 'No data' }
  })
