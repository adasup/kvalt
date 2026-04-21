import { describe, it, expect, vi } from 'vitest'
import { ReportsService } from './reports.service.js'
import type { Db } from '../db/client.js'

// ─── DB mock helpers ──────────────────────────────────────────────────────────

function selectChain(rows: unknown[]) {
  const p = Promise.resolve(rows)
  const node: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  node.limit = vi.fn().mockResolvedValue(rows)
  node.orderBy = vi.fn().mockReturnValue(node)
  node.where = vi.fn().mockReturnValue(node)
  node.innerJoin = vi.fn().mockReturnValue(node)
  node.leftJoin = vi.fn().mockReturnValue(node)
  return { from: vi.fn().mockReturnValue(node) }
}

function makeDb() {
  return { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() } as unknown as Db
}

// ─── Tests: ReportsService.projectProfitability ───────────────────────────────

describe('ReportsService.projectProfitability', () => {
  it('calculates revenue, labour cost, profit and margin', async () => {
    const db = makeDb()
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([{ revenue: 121000 }]) as never)   // invoice totals
      .mockReturnValueOnce(selectChain([{ labourCost: 40000 }]) as never) // attendance earnings

    const service = new ReportsService(db)
    const result = await service.projectProfitability('project-1')

    expect(result.revenue).toBe(121000)
    expect(result.labourCost).toBe(40000)
    expect(result.profit).toBe(81000)
    expect(result.margin).toBeCloseTo(66.9, 0)
  })

  it('returns zero margin when revenue is zero', async () => {
    const db = makeDb()
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([{ revenue: null }]) as never)
      .mockReturnValueOnce(selectChain([{ labourCost: null }]) as never)

    const result = await new ReportsService(db).projectProfitability('project-1')
    expect(result.revenue).toBe(0)
    expect(result.profit).toBe(0)
    expect(result.margin).toBe(0)
  })
})

// ─── Tests: ReportsService.monthlyEarnings ────────────────────────────────────

describe('ReportsService.monthlyEarnings', () => {
  it('returns per-employee totals for the month', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(
      selectChain([
        { userId: 'user-1', fullName: 'Karel Dvořák', totalHours: 160, totalEarnings: 32000 },
        { userId: 'user-2', fullName: 'Jan Novák',   totalHours: 120, totalEarnings: 18000 },
      ]) as never,
    )

    const result = await new ReportsService(db).monthlyEarnings('company-1', '2026-04')
    expect(result).toHaveLength(2)
    expect(result[0]?.totalEarnings).toBe(32000)
    expect(result[1]?.fullName).toBe('Jan Novák')
  })

  it('returns empty array when no records', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)

    const result = await new ReportsService(db).monthlyEarnings('company-1', '2026-04')
    expect(result).toEqual([])
  })
})
