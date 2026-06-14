import { Elysia } from 'elysia'
import { getDb } from '../../db/init'

const SITE_ID = 'site-demo-01'

function newId(): string {
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export const mdmDeviceRoutes = new Elysia({ prefix: '/api/mdm/devices' })

  .get('/', ({ query }) => {
    const db          = getDb()
    const search      = (query as any).search      ?? ''
    const device_type = (query as any).device_type ?? 'ALL'

    let sql           = 'SELECT * FROM devices WHERE site_id = ?'
    const params: unknown[] = [SITE_ID]

    if (device_type !== 'ALL') {
      sql += ' AND device_type = ?'
      params.push(device_type)
    }
    if (search) {
      sql += ' AND (name LIKE ? OR manufacturer LIKE ? OR model LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }
    sql += ' ORDER BY device_type, name'
    return db.prepare(sql).all(...params)
  })

  .get('/:id', ({ params }) => {
    const db  = getDb()
    const row = db.prepare('SELECT * FROM devices WHERE id=?').get(params.id)
    return row ?? { error: 'Not found' }
  })

  .post('/', ({ body }) => {
    const db = getDb()
    const b  = body as any
    const id = newId()
    db.run(
      `INSERT INTO devices(id, site_id, device_type, name, manufacturer, model,
         protocol, address, modbus_unit_id, max_power_w, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, SITE_ID,
       b.device_type, b.name,
       b.manufacturer ?? null, b.model ?? null,
       b.protocol ?? 'SIMULATION',
       b.address ?? null, b.modbus_unit_id ?? null,
       b.max_power_w ?? null],
    )
    return { id }
  })

  .put('/:id', ({ params, body }) => {
    const db = getDb()
    const b  = body as any
    db.run(
      `UPDATE devices
         SET device_type=?, name=?, manufacturer=?, model=?,
             protocol=?, address=?, modbus_unit_id=?,
             max_power_w=?, is_active=?, updated_at=datetime('now')
       WHERE id=?`,
      [b.device_type, b.name,
       b.manufacturer ?? null, b.model ?? null,
       b.protocol ?? 'SIMULATION',
       b.address ?? null, b.modbus_unit_id ?? null,
       b.max_power_w ?? null,
       b.is_active ?? 1,
       params.id],
    )
    return { ok: true }
  })

  .delete('/:id', ({ params }) => {
    const db = getDb()
    db.run(`UPDATE devices SET is_active=0, updated_at=datetime('now') WHERE id=?`, [params.id])
    return { ok: true }
  })
