import { Elysia } from 'elysia'
import { getDb } from '../db/init'

export const participantRoutes = new Elysia({ prefix: '/api/participants' })
  .get('/', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM participants ORDER BY display_name').all()
  })

  .get('/:id', ({ params }) => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM participants WHERE id = ?').get(params.id)
    return row ?? { error: 'Not found' }
  })
