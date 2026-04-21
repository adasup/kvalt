import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { InvoiceService, generateQrPayload } from '../services/invoices.service.js'
import { requireRole, type AppEnv } from '../middleware/auth.js'

const router = new Hono<AppEnv>()

// GET /api/invoices
router.get('/', requireRole('ADMIN'), async (c) => {
  const { companyId } = c.get('auth')
  return c.json(await new InvoiceService(c.get('db')).list(companyId))
})

// GET /api/invoices/:id
router.get('/:id', requireRole('ADMIN'), async (c) => {
  const { companyId } = c.get('auth')
  const result = await new InvoiceService(c.get('db')).getById(c.req.param('id'), companyId)
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

// POST /api/invoices — manual creation
router.post(
  '/',
  requireRole('ADMIN'),
  zValidator(
    'json',
    z.object({
      projectId: z.string().optional(),
      invoiceNumber: z.string().min(1),
      type: z.enum(['ADVANCE', 'FINAL']),
      dateIssued: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dateDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      totalWithoutVat: z.number().min(0),
      vatAmount: z.number().min(0),
      totalWithVat: z.number().min(0),
      clientName: z.string().min(1),
      clientAddress: z.string().optional(),
      clientIco: z.string().optional(),
      clientDic: z.string().optional(),
    }),
  ),
  async (c) => {
    const { companyId } = c.get('auth')
    const invoice = await new InvoiceService(c.get('db')).create({ companyId, ...c.req.valid('json') })
    return c.json(invoice, 201)
  },
)

// POST /api/invoices/from-budget/:budgetId
router.post(
  '/from-budget/:budgetId',
  requireRole('ADMIN'),
  zValidator(
    'json',
    z.object({
      invoiceNumber: z.string().min(1),
      type: z.enum(['ADVANCE', 'FINAL']),
      dateIssued: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dateDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ),
  async (c) => {
    const result = await new InvoiceService(c.get('db')).createFromBudget(
      c.req.param('budgetId'),
      c.req.valid('json'),
    )
    return c.json(result, 201)
  },
)

// PATCH /api/invoices/:id/status
router.patch(
  '/:id/status',
  requireRole('ADMIN'),
  zValidator('json', z.object({ status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'OVERDUE']) })),
  async (c) => {
    try {
      const invoice = await new InvoiceService(c.get('db')).updateStatus(
        c.req.param('id'),
        c.req.valid('json').status,
      )
      return c.json(invoice)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      const statusCode = msg.includes('transition') ? 422 : 404
      return c.json({ error: msg }, statusCode)
    }
  },
)

// GET /api/invoices/:id/qr?iban=
router.get('/:id/qr', requireRole('ADMIN'), async (c) => {
  const { companyId } = c.get('auth')
  const result = await new InvoiceService(c.get('db')).getById(c.req.param('id'), companyId)
  if (!result) return c.json({ error: 'Not found' }, 404)

  const iban = c.req.query('iban') ?? ''
  const { invoice } = result
  const payload = generateQrPayload({
    iban,
    amount: invoice.totalWithVat,
    variableSymbol: invoice.invoiceNumber,
    message: `Faktura ${invoice.invoiceNumber}`,
  })

  return c.json({ payload })
})

export { router as invoicesRoute }
