import { Elysia } from 'elysia'
import { getDb } from '../db/init'

export const alarmRoutes = new Elysia({ prefix: '/api/alarms' })
  .get('/', () => {
    const db = getDb()
    return db.prepare("SELECT * FROM alarms ORDER BY triggered_at DESC LIMIT 100").all()
  })

  .get('/active', () => {
    const db = getDb()
    return db.prepare("SELECT * FROM alarms WHERE status = 'ACTIVE' ORDER BY alarm_class DESC, triggered_at DESC").all()
  })

  .post('/:id/ack', ({ params }) => {
    const db = getDb()
    db.prepare(
      "UPDATE alarms SET status='ACKNOWLEDGED', acked_at=datetime('now') WHERE id=?"
    ).run(params.id)
    return { ok: true }
  })

  .post('/:id/close', ({ params }) => {
    const db = getDb()
    db.prepare(
      "UPDATE alarms SET status='CLOSED', closed_at=datetime('now') WHERE id=?"
    ).run(params.id)
    return { ok: true }
  })
