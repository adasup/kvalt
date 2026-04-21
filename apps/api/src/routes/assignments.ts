import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { PlanningService } from '../services/planning.service.js'
import { requireRole, type AppEnv } from '../middleware/auth.js'

const router = new Hono<AppEnv>()

const assignSchema = z.object({
  projectId: z.string().uuid(),
  date: z.string().date(),
  teamId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
})

const bulkSchema = z.object({
  projectId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  dates: z.array(z.string().date()).min(1).max(31),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  description: z.string().optional(),
})

// GET /api/assignments?week=2026-W17
router.get('/', async (c) => {
  const { companyId } = c.get('auth')
  const week = c.req.query('week')
  if (!week) return c.json({ error: 'week parameter required (e.g. 2026-W17)' }, 400)

  const service = new PlanningService(c.get('db'))
  try {
    return c.json(await service.getWeekBoard(companyId, week))
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 400)
  }
})

// GET /api/assignments/me/tomorrow
router.get('/me/tomorrow', async (c) => {
  const { userId } = c.get('auth')
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const service = new PlanningService(c.get('db'))
  const assignment = await service.getMyTomorrow(userId, tomorrowStr)
  return c.json(assignment ?? null)
})

// POST /api/assignments
router.post('/', requireRole('ADMIN', 'FOREMAN'), zValidator('json', assignSchema), async (c) => {
  const { companyId, userId } = c.get('auth')
  const service = new PlanningService(c.get('db'))

  try {
    const assignment = await service.create(companyId, userId, c.req.valid('json'))
    return c.json(assignment, 201)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 400)
  }
})

// POST /api/assignments/bulk
router.post('/bulk', requireRole('ADMIN', 'FOREMAN'), zValidator('json', bulkSchema), async (c) => {
  const { companyId, userId } = c.get('auth')
  const service = new PlanningService(c.get('db'))
  const body = c.req.valid('json')

  try {
    const assignments = await service.bulkCreate(companyId, userId, body)
    return c.json(assignments, 201)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 400)
  }
})

// PATCH /api/assignments/:id
router.patch(
  '/:id',
  requireRole('ADMIN', 'FOREMAN'),
  zValidator('json', assignSchema.omit({ projectId: true, date: true }).partial()),
  async (c) => {
    const { companyId } = c.get('auth')
    const service = new PlanningService(c.get('db'))

    try {
      return c.json(await service.update(companyId, c.req.param('id'), c.req.valid('json')))
    } catch {
      return c.json({ error: 'Not found' }, 404)
    }
  },
)

// DELETE /api/assignments/:id
router.delete('/:id', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const { companyId } = c.get('auth')
  await new PlanningService(c.get('db')).delete(companyId, c.req.param('id'))
  return c.body(null, 204)
})

export { router as assignmentsRoute }
