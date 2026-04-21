import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { ProjectsService } from '../services/projects.service.js'
import { requireRole, type AppEnv } from '../middleware/auth.js'
import type { ProjectStatus } from '@kvalt/shared'

const router = new Hono<AppEnv>()

const createSchema = z.object({
  name: z.string().min(1).max(200),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  clientIco: z.string().optional(),
  address: z.string().optional(),
  plannedStart: z.string().date().optional(),
  plannedEnd: z.string().date().optional(),
  notes: z.string().optional(),
})

const statusSchema = z.object({
  status: z.enum(['OFFER', 'APPROVED', 'IN_PROGRESS', 'HANDOVER', 'INVOICED', 'PAID', 'CANCELLED']),
})

// GET /api/projects
router.get('/', async (c) => {
  const { companyId } = c.get('auth')
  const statusParam = c.req.query('status') as ProjectStatus | undefined
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100'), 200)
  const offset = parseInt(c.req.query('offset') ?? '0')
  const service = new ProjectsService(c.get('db'))
  return c.json(await service.list(companyId, statusParam ? { status: statusParam } : undefined, { limit, offset }))
})

// POST /api/projects
router.post('/', requireRole('ADMIN', 'FOREMAN'), zValidator('json', createSchema), async (c) => {
  const { companyId } = c.get('auth')
  const service = new ProjectsService(c.get('db'))
  const project = await service.create(companyId, c.req.valid('json'))
  return c.json(project, 201)
})

// GET /api/projects/:id
router.get('/:id', async (c) => {
  const { companyId } = c.get('auth')
  const service = new ProjectsService(c.get('db'))
  const project = await service.getById(companyId, c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)
  return c.json(project)
})

// PATCH /api/projects/:id
router.patch('/:id', requireRole('ADMIN', 'FOREMAN'), zValidator('json', createSchema.partial()), async (c) => {
  const { companyId } = c.get('auth')
  const service = new ProjectsService(c.get('db'))
  try {
    return c.json(await service.update(companyId, c.req.param('id'), c.req.valid('json')))
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

// PATCH /api/projects/:id/status
router.patch('/:id/status', requireRole('ADMIN', 'FOREMAN'), zValidator('json', statusSchema), async (c) => {
  const { companyId } = c.get('auth')
  const service = new ProjectsService(c.get('db'))
  try {
    return c.json(await service.updateStatus(companyId, c.req.param('id'), c.req.valid('json').status))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    const status = msg.includes('transition') ? 422 : 404
    return c.json({ error: msg }, status)
  }
})

// DELETE /api/projects/:id
router.delete('/:id', requireRole('ADMIN'), async (c) => {
  const { companyId } = c.get('auth')
  await new ProjectsService(c.get('db')).delete(companyId, c.req.param('id'))
  return c.body(null, 204)
})

// POST /api/projects/:id/budgets/:budgetId — link budget to project
router.post('/:id/budgets/:budgetId', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const { companyId } = c.get('auth')
  await new ProjectsService(c.get('db')).linkBudget(companyId, c.req.param('id'), c.req.param('budgetId'))
  return c.body(null, 204)
})

// POST /api/projects/:id/photos — upload photo to R2
router.post('/:id/photos', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const projectId = c.req.param('id')
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const caption = formData.get('caption') as string | null

  if (!file) return c.json({ error: 'No file provided' }, 400)
  if (!file.type.startsWith('image/')) return c.json({ error: 'File must be an image' }, 400)
  if (file.size > 10 * 1024 * 1024) return c.json({ error: 'File too large (max 10MB)' }, 400)

  const ext = file.type.split('/')[1] ?? 'jpg'
  const key = `projects/${projectId}/photos/${crypto.randomUUID()}.${ext}`

  await c.env.R2.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  const photo = await new ProjectsService(c.get('db')).addPhoto(
    projectId,
    key,
    caption ?? undefined,
  )
  return c.json(photo, 201)
})

// GET /api/projects/:id/photos/:photoId — serve photo from R2
router.get('/:id/photos/:photoId', async (c) => {
  const { companyId } = c.get('auth')
  const service = new ProjectsService(c.get('db'))
  const project = await service.getById(companyId, c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)

  const photo = project.photos.find((p) => p.id === c.req.param('photoId'))
  if (!photo) return c.json({ error: 'Photo not found' }, 404)

  const obj = await c.env.R2.get(photo.storagePath)
  if (!obj) return c.json({ error: 'File not found in storage' }, 404)

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000',
    },
  })
})

// DELETE /api/projects/:id/photos/:photoId
router.delete('/:id/photos/:photoId', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const { companyId } = c.get('auth')
  const service = new ProjectsService(c.get('db'))
  const project = await service.getById(companyId, c.req.param('id'))
  if (!project) return c.json({ error: 'Not found' }, 404)

  const photo = project.photos.find((p) => p.id === c.req.param('photoId'))
  if (!photo) return c.json({ error: 'Photo not found' }, 404)

  await Promise.all([
    c.env.R2.delete(photo.storagePath),
    service.deletePhoto(c.req.param('id'), c.req.param('photoId')),
  ])
  return c.body(null, 204)
})

export { router as projectsRoute }
