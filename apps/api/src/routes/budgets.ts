import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { BudgetsService } from '../services/budgets.service.js'
import { requireRole, type AppEnv } from '../middleware/auth.js'
import { createClaudeFn } from '../lib/claude.js'
import { eq } from 'drizzle-orm'
import { priceListItems, priceLists } from '../db/schema.js'

const router = new Hono<AppEnv>()

const createSchema = z.object({
  name: z.string().min(1).max(200),
  projectId: z.string().uuid().optional(),
  vatRate: z.number().min(0).max(100).optional(),
})

const updateSchema = createSchema.partial().extend({
  status: z.enum(['DRAFT', 'DONE']).optional(),
})

const itemSchema = z.object({
  name: z.string().min(1),
  rawText: z.string().optional(),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  totalPrice: z.number().min(0),
  matchType: z.enum(['MATCHED', 'ESTIMATED', 'MANUAL']).optional(),
  matchedPriceItem: z.string().optional(),
  category: z.string().optional(),
})

// GET /api/budgets
router.get('/', async (c) => {
  const { companyId } = c.get('auth')
  const service = new BudgetsService(c.get('db'))
  const list = await service.list(companyId)
  return c.json(list)
})

// POST /api/budgets
router.post('/', requireRole('ADMIN', 'FOREMAN'), zValidator('json', createSchema), async (c) => {
  const { companyId } = c.get('auth')
  const service = new BudgetsService(c.get('db'))
  const budget = await service.create(companyId, c.req.valid('json'))
  return c.json(budget, 201)
})

// GET /api/budgets/:id
router.get('/:id', async (c) => {
  const { companyId } = c.get('auth')
  const service = new BudgetsService(c.get('db'))
  const budget = await service.getById(companyId, c.req.param('id'))
  if (!budget) return c.json({ error: 'Not found' }, 404)
  return c.json(budget)
})

// PATCH /api/budgets/:id
router.patch('/:id', requireRole('ADMIN', 'FOREMAN'), zValidator('json', updateSchema), async (c) => {
  const { companyId } = c.get('auth')
  const service = new BudgetsService(c.get('db'))
  try {
    const budget = await service.update(companyId, c.req.param('id'), c.req.valid('json'))
    return c.json(budget)
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

// DELETE /api/budgets/:id
router.delete('/:id', requireRole('ADMIN'), async (c) => {
  const { companyId } = c.get('auth')
  const service = new BudgetsService(c.get('db'))
  await service.delete(companyId, c.req.param('id'))
  return c.body(null, 204)
})

// POST /api/budgets/:id/transcripts
router.post('/:id/transcripts', requireRole('ADMIN', 'FOREMAN'), zValidator('json', z.object({ text: z.string().min(1) })), async (c) => {
  const service = new BudgetsService(c.get('db'))
  const { text } = c.req.valid('json')
  const transcript = await service.addTranscript(c.req.param('id'), text)
  return c.json(transcript, 201)
})

// POST /api/budgets/:id/parse
router.post('/:id/parse', requireRole('ADMIN', 'FOREMAN'), zValidator('json', z.object({ text: z.string().min(1) })), async (c) => {
  const apiKey = c.env.ANTHROPIC_API_KEY
  if (!apiKey) return c.json({ error: 'AI not configured' }, 503)

  const { companyId } = c.get('auth')
  const db = c.get('db')
  const service = new BudgetsService(db)

  // Load company price list for matching
  const priceRows = await db
    .select({
      name: priceListItems.name,
      unit: priceListItems.unit,
      avgPrice: priceListItems.avgPrice,
      category: priceListItems.category,
    })
    .from(priceListItems)
    .leftJoin(priceLists, eq(priceListItems.priceListId, priceLists.id))
    .where(eq(priceLists.companyId, companyId))

  const { text } = c.req.valid('json')
  const claudeFn = createClaudeFn(apiKey)
  const items = await service.parse(c.req.param('id'), text, priceRows, claudeFn)

  return c.json(items, 201)
})

// POST /api/budgets/:id/items
router.post('/:id/items', requireRole('ADMIN', 'FOREMAN'), zValidator('json', itemSchema), async (c) => {
  const service = new BudgetsService(c.get('db'))
  const item = await service.addItem(c.req.param('id'), c.req.valid('json'))
  return c.json(item, 201)
})

// PATCH /api/budgets/:id/items/:itemId
router.patch('/:id/items/:itemId', requireRole('ADMIN', 'FOREMAN'), zValidator('json', itemSchema.partial()), async (c) => {
  const service = new BudgetsService(c.get('db'))
  try {
    const item = await service.updateItem(c.req.param('id'), c.req.param('itemId'), c.req.valid('json'))
    return c.json(item)
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

// DELETE /api/budgets/:id/items/:itemId
router.delete('/:id/items/:itemId', requireRole('ADMIN', 'FOREMAN'), async (c) => {
  const service = new BudgetsService(c.get('db'))
  await service.deleteItem(c.req.param('id'), c.req.param('itemId'))
  return c.body(null, 204)
})

// GET /api/budgets/:id/export/xlsx
router.get('/:id/export/xlsx', async (c) => {
  const { companyId } = c.get('auth')
  const service = new BudgetsService(c.get('db'))
  try {
    const buffer = await service.exportXlsx(companyId, c.req.param('id'))
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="rozpocet-${c.req.param('id')}.xlsx"`,
      },
    })
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

// GET /api/budgets/:id/export/pdf
router.get('/:id/export/pdf', async (c) => {
  const { companyId } = c.get('auth')
  const service = new BudgetsService(c.get('db'))
  try {
    const html = await service.exportPdfHtml(companyId, c.req.param('id'))
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="rozpocet-${c.req.param('id')}.html"`,
      },
    })
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

export { router as budgetsRoute }
