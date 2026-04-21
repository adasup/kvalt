import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { NotificationsService } from '../services/notifications.service.js'
import { type AppEnv } from '../middleware/auth.js'

const router = new Hono<AppEnv>()

// GET /api/notifications/me
router.get('/me', async (c) => {
  const { userId } = c.get('auth')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 200)
  const service = new NotificationsService(c.get('db'))
  return c.json(await service.listForUser(userId, limit))
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (c) => {
  const { userId } = c.get('auth')
  await new NotificationsService(c.get('db')).markRead(c.req.param('id'), userId)
  return c.body(null, 204)
})

// POST /api/notifications/register-push
router.post(
  '/register-push',
  zValidator('json', z.object({ pushToken: z.string().min(1) })),
  async (c) => {
    const { userId } = c.get('auth')
    await new NotificationsService(c.get('db')).registerPushToken(userId, c.req.valid('json').pushToken)
    return c.body(null, 204)
  },
)

export { router as notificationsRoute }
