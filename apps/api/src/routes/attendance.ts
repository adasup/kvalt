import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { AttendanceService } from '../services/attendance.service.js'
import { requireRole, type AppEnv } from '../middleware/auth.js'

const router = new Hono<AppEnv>()

// POST /api/attendance/check-in
router.post(
  '/check-in',
  zValidator(
    'json',
    z.object({
      projectId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      checkIn: z.string().regex(/^\d{2}:\d{2}$/),
      type: z.enum(['REGULAR', 'OVERTIME', 'WEEKEND', 'HOLIDAY', 'TRAVEL']).optional(),
      assignmentId: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
  async (c) => {
    const { userId } = c.get('auth')
    const body = c.req.valid('json')
    const service = new AttendanceService(c.get('db'))
    const record = await service.checkIn({ userId, ...body })
    return c.json(record, 201)
  },
)

// POST /api/attendance/check-out/:id
router.post(
  '/check-out/:id',
  zValidator('json', z.object({
    checkOut: z.string().regex(/^\d{2}:\d{2}$/),
    breakMinutes: z.number().int().min(0).max(480).optional(),
  })),
  async (c) => {
    const { userId } = c.get('auth')
    const body = c.req.valid('json')
    const record = await new AttendanceService(c.get('db')).checkOut(
      c.req.param('id'),
      userId,
      body.checkOut,
      body.breakMinutes ?? 0,
    )
    return c.json(record)
  },
)

// GET /api/attendance/me?from=&to=
router.get('/me', async (c) => {
  const { userId } = c.get('auth')
  const from = c.req.query('from') ?? ''
  const to = c.req.query('to') ?? ''
  const service = new AttendanceService(c.get('db'))
  return c.json(await service.listForUser(userId, from, to))
})

// GET /api/attendance/me/earnings?from=&to=
router.get('/me/earnings', async (c) => {
  const { userId } = c.get('auth')
  const from = c.req.query('from') ?? ''
  const to = c.req.query('to') ?? ''
  const total = await new AttendanceService(c.get('db')).getEarnings(userId, from, to)
  return c.json({ total })
})

// GET /api/attendance/project/:projectId?from=&to=  (admin + foreman)
router.get('/project/:projectId', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const { companyId } = c.get('auth')
  const from = c.req.query('from') ?? ''
  const to = c.req.query('to') ?? ''
  const service = new AttendanceService(c.get('db'))
  return c.json(await service.listForProject(companyId, c.req.param('projectId'), from, to))
})

// PATCH /api/attendance/:id/approve  (admin + foreman)
router.patch('/:id/approve', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const { userId, companyId } = c.get('auth')
  await new AttendanceService(c.get('db')).approve(c.req.param('id'), userId, companyId)
  return c.body(null, 204)
})

// GET /api/attendance/export/:yearMonth  (admin only)
router.get('/export/:yearMonth', requireRole('ADMIN'), async (c) => {
  const { companyId } = c.get('auth')
  const csv = await new AttendanceService(c.get('db')).exportMonthCsv(
    companyId,
    c.req.param('yearMonth'),
  )
  return c.text(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="dochazka-${c.req.param('yearMonth')}.csv"`,
  })
})

export { router as attendanceRoute }
