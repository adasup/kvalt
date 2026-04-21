import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { TeamsService } from '../services/teams.service.js'
import { requireRole, type AppEnv } from '../middleware/auth.js'

const router = new Hono<AppEnv>()

const createSchema = z.object({
  name: z.string().min(1).max(100),
  leaderId: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// GET /api/teams
router.get('/', async (c) => {
  const { companyId, role, userId } = c.get('auth')
  const service = new TeamsService(c.get('db'))

  if (role === 'FOREMAN') {
    return c.json(await service.list(companyId, { leaderId: userId }))
  }
  if (role === 'WORKER') {
    const team = await service.getMemberTeam(companyId, userId)
    return c.json(team ? [team] : [])
  }
  return c.json(await service.list(companyId))
})

// POST /api/teams
router.post('/', requireRole('ADMIN'), zValidator('json', createSchema), async (c) => {
  const { companyId } = c.get('auth')
  const team = await new TeamsService(c.get('db')).create(companyId, c.req.valid('json'))
  return c.json(team, 201)
})

// GET /api/teams/:id
router.get('/:id', async (c) => {
  const { companyId, role, userId } = c.get('auth')
  const service = new TeamsService(c.get('db'))
  const team = await service.getById(companyId, c.req.param('id'))
  if (!team) return c.json({ error: 'Not found' }, 404)

  if (role === 'WORKER') {
    const isMember = team.members.some((m) => m.userId === userId)
    if (!isMember) return c.json({ error: 'Forbidden' }, 403)
  }
  if (role === 'FOREMAN' && team.leaderId !== userId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return c.json(team)
})

// PATCH /api/teams/:id
router.patch('/:id', requireRole('ADMIN', 'FOREMAN'), zValidator('json', createSchema.partial()), async (c) => {
  const { companyId, role, userId } = c.get('auth')
  const service = new TeamsService(c.get('db'))

  if (role === 'FOREMAN') {
    const isLeader = await service.isLeader(companyId, c.req.param('id'), userId)
    if (!isLeader) return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    return c.json(await service.update(companyId, c.req.param('id'), c.req.valid('json')))
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

// DELETE /api/teams/:id
router.delete('/:id', requireRole('ADMIN'), async (c) => {
  const { companyId } = c.get('auth')
  await new TeamsService(c.get('db')).delete(companyId, c.req.param('id'))
  return c.body(null, 204)
})

// POST /api/teams/:id/members
router.post(
  '/:id/members',
  requireRole('ADMIN', 'FOREMAN'),
  zValidator('json', z.object({ userId: z.string().uuid() })),
  async (c) => {
    const { companyId, role, userId } = c.get('auth')
    const service = new TeamsService(c.get('db'))
    const teamId = c.req.param('id')

    if (role === 'FOREMAN') {
      const isLeader = await service.isLeader(companyId, teamId, userId)
      if (!isLeader) return c.json({ error: 'Forbidden' }, 403)
    }

    const member = await service.addMember(teamId, c.req.valid('json').userId)
    return c.json(member, 201)
  },
)

// DELETE /api/teams/:id/members/:userId
router.delete('/:id/members/:userId', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const { companyId, role, userId } = c.get('auth')
  const service = new TeamsService(c.get('db'))
  const teamId = c.req.param('id')

  if (role === 'FOREMAN') {
    const isLeader = await service.isLeader(companyId, teamId, userId)
    if (!isLeader) return c.json({ error: 'Forbidden' }, 403)
  }

  await service.removeMember(teamId, c.req.param('userId'))
  return c.body(null, 204)
})

export { router as teamsRoute }
