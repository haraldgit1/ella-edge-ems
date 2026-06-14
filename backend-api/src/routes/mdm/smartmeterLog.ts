import { Elysia } from 'elysia'
import { getDb } from '../../db/init'

export const mdmSmartmeterLogRoutes = new Elysia({ prefix: '/api/mdm/smartmeter-log' })

  .get('/', ({ query }) => {
    const db     = getDb()
    const limit  = Math.min(500, parseInt((query as any).limit ?? '200'))
    const status = (query as any).status ?? 'ALL'
    const cid    = (query as any).cid    ?? ''
    const from   = (query as any).from   ?? ''
    const to     = (query as any).to     ?? ''

    let sql     = 'SELECT * FROM smartmeter_log WHERE 1=1'
    const params: unknown[] = []

    if (status !== 'ALL') {
      sql += ' AND status = ?'; params.push(status)
    }
    if (cid) {
      sql += ' AND cid LIKE ?'; params.push(`%${cid}%`)
    }
    if (from) {
      sql += ' AND received_at >= ?'; params.push(from)
    }
    if (to) {
      sql += ' AND received_at <= ?'
      params.push(to.length === 10 ? to + 'T23:59:59Z' : to)
    }
    sql += ' ORDER BY received_at DESC LIMIT ?'
    params.push(limit)
    return db.prepare(sql).all(...params)
  })

  .put('/:id', ({ params, body }) => {
    const db = getDb()
    const b  = body as any
    db.run(
      `UPDATE smartmeter_log
         SET cid=?, pact_str=?, meter_id=?, status=?, error_msg=?
       WHERE id=?`,
      [b.cid ?? null, b.pact_str ?? null,
       b.meter_id ?? null, b.status ?? 'OK',
       b.error_msg ?? null, params.id],
    )
    return { ok: true }
  })

  .delete('/:id', ({ params }) => {
    const db = getDb()
    db.run('DELETE FROM smartmeter_log WHERE id=?', [params.id])
    return { ok: true }
  })
