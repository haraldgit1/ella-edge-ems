import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { initDatabase } from './db/init'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { participantRoutes } from './routes/participants'
import { meterRoutes } from './routes/meters'
import { dashboardRoutes } from './routes/dashboard'
import { alarmRoutes } from './routes/alarms'
import { controlDecisionRoutes } from './routes/controlDecisions'
import { settlementRoutes } from './routes/settlement'

const PORT = parseInt(process.env.API_PORT ?? '3000')

await initDatabase()

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/api/docs' }))
  .use(healthRoutes)
  .use(authRoutes)
  .use(participantRoutes)
  .use(meterRoutes)
  .use(dashboardRoutes)
  .use(alarmRoutes)
  .use(controlDecisionRoutes)
  .use(settlementRoutes)
  .listen(PORT)

console.log(`Ella Backend API running on port ${PORT}`)
