import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { DiaryService } from '../services/diary.service.js'
import { requireRole, type AppEnv } from '../middleware/auth.js'
import { createDiaryClaudeFn } from '../lib/claude.js'
import { fetchWeather } from '../lib/weather.js'

const router = new Hono<AppEnv>()

// GET /api/diary/:projectId
router.get('/:projectId', async (c) => {
  const service = new DiaryService(c.get('db'))
  return c.json(await service.list(c.req.param('projectId')))
})

// GET /api/diary/:projectId/:entryId
router.get('/:projectId/:entryId', async (c) => {
  const service = new DiaryService(c.get('db'))
  const result = await service.getById(c.req.param('entryId'), c.req.param('projectId'))
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

// POST /api/diary/:projectId
router.post(
  '/:projectId',
  requireRole('ADMIN', 'FOREMAN'),
  zValidator(
    'json',
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      description: z.string().min(1),
      weather: z.string().optional(),
      temperature: z.number().optional(),
      workersPresent: z.number().int().min(0).optional(),
      structureWithAI: z.boolean().optional(),
      lat: z.number().optional(),
      lon: z.number().optional(),
    }),
  ),
  async (c) => {
    const { userId } = c.get('auth')
    const body = c.req.valid('json')
    const service = new DiaryService(c.get('db'))

    let description = body.description
    let weather = body.weather
    let temperature = body.temperature

    // AI structuring
    if (body.structureWithAI) {
      const claudeFn = createDiaryClaudeFn(c.env.ANTHROPIC_API_KEY)
      description = await service.structureWithAI(description, claudeFn)
    }

    // Auto-fetch weather if coordinates provided and weather not supplied
    if (!weather && body.lat !== undefined && body.lon !== undefined) {
      try {
        const w = await fetchWeather(body.lat, body.lon, body.date)
        weather = w.description
        temperature = w.temperature
      } catch {
        // non-fatal
      }
    }

    const entry = await service.create({
      projectId: c.req.param('projectId'),
      authorId: userId,
      date: body.date,
      description,
      weather,
      temperature,
      workersPresent: body.workersPresent,
    })

    return c.json(entry, 201)
  },
)

// PATCH /api/diary/:projectId/:entryId
router.patch(
  '/:projectId/:entryId',
  requireRole('ADMIN', 'FOREMAN'),
  zValidator(
    'json',
    z.object({
      description: z.string().optional(),
      weather: z.string().optional(),
      temperature: z.number().optional(),
      workersPresent: z.number().int().min(0).optional(),
    }),
  ),
  async (c) => {
    const service = new DiaryService(c.get('db'))
    const entry = await service.update(c.req.param('entryId'), c.req.valid('json'))
    return c.json(entry)
  },
)

// DELETE /api/diary/:projectId/:entryId
router.delete('/:projectId/:entryId', requireRole('ADMIN'), async (c) => {
  await new DiaryService(c.get('db')).delete(c.req.param('entryId'))
  return c.body(null, 204)
})

// POST /api/diary/:projectId/:entryId/photos  — multipart upload to R2
router.post('/:projectId/:entryId/photos', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const entryId = c.req.param('entryId')
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const caption = formData.get('caption') as string | undefined

  if (!file) return c.json({ error: 'file field required' }, 400)
  if (!file.type.startsWith('image/')) return c.json({ error: 'File must be an image' }, 400)
  if (file.size > 10 * 1024 * 1024) return c.json({ error: 'File too large (max 10MB)' }, 400)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `diary/${entryId}/${crypto.randomUUID()}.${ext}`

  await c.env.R2.put(storagePath, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  const service = new DiaryService(c.get('db'))
  const photo = await service.addPhoto(entryId, storagePath, caption ?? undefined)
  return c.json(photo, 201)
})

// DELETE /api/diary/:projectId/:entryId/photos/:photoId
router.delete('/:projectId/:entryId/photos/:photoId', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const service = new DiaryService(c.get('db'))
  const storagePath = await service.deletePhoto(c.req.param('photoId'))
  await c.env.R2.delete(storagePath)
  return c.body(null, 204)
})

// GET /api/diary/:projectId/extra-works
router.get('/:projectId/extra-works', async (c) => {
  const service = new DiaryService(c.get('db'))
  return c.json(await service.listExtraWorks(c.req.param('projectId')))
})

// POST /api/diary/:projectId/extra-works
router.post(
  '/:projectId/extra-works',
  requireRole('ADMIN', 'FOREMAN'),
  zValidator(
    'json',
    z.object({
      description: z.string().min(1),
      scope: z.string().optional(),
      estimatedPrice: z.number().min(0).optional(),
    }),
  ),
  async (c) => {
    const service = new DiaryService(c.get('db'))
    const work = await service.addExtraWork({
      projectId: c.req.param('projectId'),
      ...c.req.valid('json'),
    })
    return c.json(work, 201)
  },
)

// PATCH /api/diary/:projectId/extra-works/:workId/approve
router.patch('/:projectId/extra-works/:workId/approve', requireRole('ADMIN'), async (c) => {
  await new DiaryService(c.get('db')).approveExtraWork(c.req.param('workId'))
  return c.body(null, 204)
})

export { router as diaryRoute }
