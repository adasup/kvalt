import { Hono } from 'hono'
import { ReportsService } from '../services/reports.service.js'
import { requireRole, type AppEnv } from '../middleware/auth.js'

const router = new Hono<AppEnv>()

// GET /api/reports/projects/:projectId/profitability
router.get('/projects/:projectId/profitability', requireRole('ADMIN'), async (c) => {
  const result = await new ReportsService(c.get('db')).projectProfitability(c.req.param('projectId'))
  return c.json(result)
})

// GET /api/reports/earnings/:yearMonth   e.g. 2026-04
router.get('/earnings/:yearMonth', requireRole('ADMIN'), async (c) => {
  const { companyId } = c.get('auth')
  const result = await new ReportsService(c.get('db')).monthlyEarnings(companyId, c.req.param('yearMonth'))
  return c.json(result)
})

export { router as reportsRoute }
