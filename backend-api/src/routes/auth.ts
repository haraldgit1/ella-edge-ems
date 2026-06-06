import { Elysia, t } from 'elysia'
import { getDb } from '../db/init'

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .post('/login', ({ body, set }) => {
    // TODO: implement JWT auth
    set.status = 501
    return { error: 'Not implemented yet' }
  }, {
    body: t.Object({ username: t.String(), password: t.String() })
  })

  .post('/logout', () => ({ ok: true }))

  .get('/me', ({ set }) => {
    set.status = 401
    return { error: 'Not authenticated' }
  })
