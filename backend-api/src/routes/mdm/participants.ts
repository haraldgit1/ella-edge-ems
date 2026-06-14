import { Elysia } from 'elysia'
import { getDb } from '../../db/init'

const SITE_ID     = 'site-demo-01'
const BUILDING_ID = 'bld-01'

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

const SELECT_SQL = `
  SELECT
    p.id, p.display_name, p.participant_status,
    p.valid_from, p.valid_to, p.is_active, p.tariff_id,
    a.id         AS apartment_id,
    a.unit_label AS unit_label,
    a.floor      AS floor,
    m.id         AS meter_id,
    m.serial_number,
    m.cid,
    COALESCE(m.max_load_w, 4000) AS max_load_w,
    m.protocol
  FROM participants p
  LEFT JOIN apartments a ON a.id = p.apartment_id
  LEFT JOIN meters     m ON m.id = p.meter_id
  WHERE p.site_id = ?
`

export const mdmParticipantRoutes = new Elysia({ prefix: '/api/mdm/participants' })

  .get('/', ({ query }) => {
    const db = getDb()
    const search  = (query as any).search  ?? ''
    const status  = (query as any).status  ?? 'ALL'
    const active  = (query as any).active  ?? 'ALL'

    let sql = SELECT_SQL
    const params: unknown[] = [SITE_ID]

    if (status !== 'ALL') {
      sql += ' AND p.participant_status = ?'
      params.push(status)
    }
    if (active === '1') {
      sql += ' AND p.is_active = 1'
    } else if (active === '0') {
      sql += ' AND p.is_active = 0'
    }
    if (search) {
      sql += ' AND (p.display_name LIKE ? OR m.cid LIKE ? OR m.serial_number LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }
    sql += ' ORDER BY p.is_active DESC, p.display_name'
    return db.prepare(sql).all(...params)
  })

  .get('/:id', ({ params }) => {
    const db  = getDb()
    const row = db.prepare(SELECT_SQL + ' AND p.id = ?').get(SITE_ID, params.id)
    return row ?? { error: 'Not found' }
  })

  .post('/', ({ body }) => {
    const db  = getDb()
    const b   = body as any
    const aptId  = newId('apt')
    const metId  = newId('meter')
    const partId = newId('part')

    db.run(
      `INSERT INTO apartments(id, building_id, site_id, unit_label, floor)
       VALUES (?, ?, ?, ?, ?)`,
      [aptId, BUILDING_ID, SITE_ID,
       b.unit_label ?? 'Top ?', b.floor ?? 0],
    )
    db.run(
      `INSERT INTO meters(id, site_id, apartment_id, serial_number, cid,
         max_load_w, protocol, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [metId, SITE_ID, aptId,
       b.serial_number ?? null,
       b.cid ?? null,
       b.max_load_w ?? 4000,
       b.protocol ?? 'SIMULATION'],
    )
    db.run(
      `INSERT INTO participants(id, site_id, apartment_id, meter_id, tariff_id,
         display_name, participant_status, valid_from, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [partId, SITE_ID, aptId, metId,
       b.tariff_id ?? (b.participant_status === 'BPLUS' ? 'tariff-demo-01' : null),
       b.display_name,
       b.participant_status ?? 'BPLUS',
       b.valid_from ?? new Date().toISOString().slice(0, 10)],
    )
    return { id: partId, meter_id: metId, apartment_id: aptId }
  })

  .put('/:id', ({ params, body }) => {
    const db = getDb()
    const b  = body as any
    db.run(
      `UPDATE participants
         SET display_name=?, participant_status=?, valid_from=?, valid_to=?,
             tariff_id=?, is_active=?, updated_at=datetime('now')
       WHERE id=?`,
      [b.display_name, b.participant_status,
       b.valid_from, b.valid_to ?? null,
       b.tariff_id ?? null,
       b.is_active ?? 1,
       params.id],
    )
    if (b.apartment_id) {
      db.run(
        `UPDATE apartments SET unit_label=?, floor=? WHERE id=?`,
        [b.unit_label, b.floor ?? 0, b.apartment_id],
      )
    }
    if (b.meter_id) {
      db.run(
        `UPDATE meters
           SET serial_number=?, cid=?, max_load_w=?, protocol=?,
               updated_at=datetime('now')
         WHERE id=?`,
        [b.serial_number ?? null, b.cid ?? null,
         b.max_load_w ?? 4000, b.protocol ?? 'SIMULATION',
         b.meter_id],
      )
    }
    return { ok: true }
  })

  .delete('/:id', ({ params }) => {
    const db = getDb()
    const p  = db.prepare('SELECT meter_id FROM participants WHERE id=?').get(params.id) as any
    db.run(`UPDATE participants SET is_active=0, updated_at=datetime('now') WHERE id=?`, [params.id])
    if (p?.meter_id) {
      db.run(`UPDATE meters SET is_active=0, updated_at=datetime('now') WHERE id=?`, [p.meter_id])
    }
    return { ok: true }
  })
