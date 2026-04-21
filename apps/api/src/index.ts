import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createDb } from './db/client.js'
import { authMiddleware, type AppEnv } from './middleware/auth.js'
import { budgetsRoute } from './routes/budgets.js'
import { projectsRoute } from './routes/projects.js'
import { teamsRoute } from './routes/teams.js'
import { assignmentsRoute } from './routes/assignments.js'
import { notificationsRoute } from './routes/notifications.js'
import { attendanceRoute } from './routes/attendance.js'
import { diaryRoute } from './routes/diary.js'
import { invoicesRoute } from './routes/invoices.js'
import { reportsRoute } from './routes/reports.js'
import { PlanningService } from './services/planning.service.js'
import { NotificationsService, createExpoPushSender } from './services/notifications.service.js'

const app = new Hono<AppEnv>()

let cachedDb: ReturnType<typeof createDb> | null = null

app.use('*', logger())
app.use('/api/*', cors({
  origin: ['https://kvalt.pages.dev', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.use('/api/*', async (c, next) => {
  cachedDb ??= createDb(c.env.DATABASE_URL)
  c.set('db', cachedDb)
  await next()
})

app.use('/api/*', authMiddleware)

app.get('/health', (c) => c.json({ status: 'ok', version: '0.1.0' }))

app.route('/api/budgets', budgetsRoute)
app.route('/api/projects', projectsRoute)
app.route('/api/teams', teamsRoute)
app.route('/api/assignments', assignmentsRoute)
app.route('/api/notifications', notificationsRoute)
app.route('/api/attendance', attendanceRoute)
app.route('/api/diary', diaryRoute)
app.route('/api/invoices', invoicesRoute)
app.route('/api/reports', reportsRoute)

// ─── Cloudflare Queue message type ────────────────────────────────────────────

interface NotificationQueueMessage {
  companyId: string
  tomorrowDate: string
}

// ─── Workers export ───────────────────────────────────────────────────────────

export default {
  fetch: app.fetch,

  // Cron trigger: 0 17 * * * = 18:00 CET
  async scheduled(event: ScheduledEvent, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(env))
  },

  // Queue consumer: processes push notifications
  async queue(
    batch: MessageBatch<NotificationQueueMessage>,
    env: AppEnv['Bindings'],
  ) {
    cachedDb ??= createDb(env.DATABASE_URL)
    const db = cachedDb
    const notifService = new NotificationsService(db)
    const sendPush = createExpoPushSender()

    for (const msg of batch.messages) {
      const { companyId, tomorrowDate } = msg.body
      const planningService = new PlanningService(db)
      const assignments = await planningService.getTomorrowUnsent(companyId, tomorrowDate)
      await notifService.sendTomorrowNotifications(assignments, sendPush)
      msg.ack()
    }
  },
}

// ─── Cron: enqueue per-company notification jobs ──────────────────────────────

async function handleCron(env: AppEnv['Bindings']) {
  cachedDb ??= createDb(env.DATABASE_URL)
  const db = cachedDb

  // Get all active companies
  const { companies } = await import('./db/schema.js')
  const rows = await db.select({ id: companies.id }).from(companies)

  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowDate = tomorrow.toISOString().slice(0, 10)

  await Promise.all(
    rows.map((company) =>
      env.NOTIFICATION_QUEUE.send({ companyId: company.id, tomorrowDate } satisfies NotificationQueueMessage),
    ),
  )

  console.log(`Cron: enqueued notifications for ${rows.length} companies, tomorrow=${tomorrowDate}`)
}
