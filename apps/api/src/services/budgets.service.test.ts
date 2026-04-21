import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BudgetsService } from './budgets.service.js'
import type { Db } from '../db/client.js'

// ─── DB mock helpers ──────────────────────────────────────────────────────────

function returning(rows: unknown[]) {
  return { returning: vi.fn().mockResolvedValue(rows) }
}

function selectChain(rows: unknown[]) {
  const p = Promise.resolve(rows)
  const end: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  end.limit = vi.fn().mockResolvedValue(rows)
  end.orderBy = vi.fn().mockReturnValue(end)
  const whereChain = { ...end, where: vi.fn().mockReturnValue(end) }
  end.where = vi.fn().mockReturnValue(end)
  const fromChain = { where: vi.fn().mockReturnValue(end), orderBy: vi.fn().mockReturnValue(end) }
  return { from: vi.fn().mockReturnValue(fromChain) }
}

function makeDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as Db
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-1'
const BUDGET_ID = 'budget-1'

const mockBudget = {
  id: BUDGET_ID,
  companyId: COMPANY_ID,
  projectId: null,
  name: 'Rekonstrukce koupelny',
  status: 'DRAFT' as const,
  vatRate: 21,
  totalWithoutVat: 0,
  createdAt: new Date('2026-04-21'),
  updatedAt: new Date('2026-04-21'),
}

const mockItem = {
  id: 'item-1',
  budgetId: BUDGET_ID,
  name: 'Obklad koupelna',
  rawText: 'obklady do koupelny',
  unit: 'm2',
  quantity: 25,
  unitPrice: 890,
  totalPrice: 22250,
  matchType: 'MATCHED' as const,
  matchedPriceItem: 'Keramický obklad',
  category: 'Obklady',
  sortOrder: 0,
}

const mockTranscript = {
  id: 'tr-1',
  budgetId: BUDGET_ID,
  text: 'obklady do koupelny 25 m2',
  wordCount: 5,
  createdAt: new Date('2026-04-21'),
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BudgetsService.create', () => {
  it('inserts a budget and returns it', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockBudget])) } as never)
    const service = new BudgetsService(db)

    const result = await service.create(COMPANY_ID, { name: 'Rekonstrukce koupelny', vatRate: 21 })

    expect(db.insert).toHaveBeenCalled()
    expect(result.name).toBe('Rekonstrukce koupelny')
    expect(result.companyId).toBe(COMPANY_ID)
  })

  it('sets status to DRAFT by default', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockBudget])) } as never)
    const service = new BudgetsService(db)

    const result = await service.create(COMPANY_ID, { name: 'Test' })
    expect(result.status).toBe('DRAFT')
  })

  it('throws if insert returns nothing', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([])) } as never)
    const service = new BudgetsService(db)

    await expect(service.create(COMPANY_ID, { name: 'Test' })).rejects.toThrow()
  })
})

describe('BudgetsService.list', () => {
  it('returns budgets filtered by companyId', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockBudget]) as never)
    const service = new BudgetsService(db)

    const result = await service.list(COMPANY_ID)

    expect(db.select).toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]?.companyId).toBe(COMPANY_ID)
  })

  it('returns empty array when no budgets exist', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    const service = new BudgetsService(db)

    const result = await service.list(COMPANY_ID)
    expect(result).toEqual([])
  })
})

describe('BudgetsService.getById', () => {
  it('returns budget with items and transcripts', async () => {
    const db = makeDb()
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([mockBudget]) as never)
      .mockReturnValueOnce(selectChain([mockItem]) as never)
      .mockReturnValueOnce(selectChain([mockTranscript]) as never)
    const service = new BudgetsService(db)

    const result = await service.getById(COMPANY_ID, BUDGET_ID)

    expect(result).not.toBeNull()
    expect(result?.id).toBe(BUDGET_ID)
    expect(result?.items).toHaveLength(1)
    expect(result?.transcripts).toHaveLength(1)
  })

  it('returns null when budget not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    const service = new BudgetsService(db)

    const result = await service.getById(COMPANY_ID, 'nonexistent')
    expect(result).toBeNull()
  })

  it('does not return budgets from other companies', async () => {
    const db = makeDb()
    // Budget exists but belongs to a different company → service filters by companyId
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    const service = new BudgetsService(db)

    const result = await service.getById('other-company', BUDGET_ID)
    expect(result).toBeNull()
  })
})

describe('BudgetsService.addTranscript', () => {
  it('inserts a transcript and returns it', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockTranscript])) } as never)
    const service = new BudgetsService(db)

    const result = await service.addTranscript(BUDGET_ID, 'obklady do koupelny 25 m2')
    expect(result.text).toBe('obklady do koupelny 25 m2')
    expect(result.wordCount).toBe(5)
  })

  it('counts words correctly', async () => {
    const db = makeDb()
    const transcript = { ...mockTranscript, text: 'a b c', wordCount: 3 }
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([transcript])) } as never)
    const service = new BudgetsService(db)

    const result = await service.addTranscript(BUDGET_ID, 'a b c')
    expect(result.wordCount).toBe(3)
  })
})

describe('BudgetsService.parse', () => {
  it('calls Claude and inserts returned items', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockItem])) } as never)
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never)

    const service = new BudgetsService(db)

    const mockClaude = vi.fn().mockResolvedValue([
      { name: 'Obklad', unit: 'm2', quantity: 25, unitPrice: 890, totalPrice: 22250, matchType: 'MATCHED', rawText: 'obklady', category: 'Obklady', matchedPriceItem: undefined },
    ])

    const result = await service.parse(BUDGET_ID, 'obklady do koupelny 25 m2', [], mockClaude)

    expect(mockClaude).toHaveBeenCalledOnce()
    expect(db.insert).toHaveBeenCalled()
    expect(result).toHaveLength(1)
  })

  it('returns empty array when Claude returns no items', async () => {
    const db = makeDb()
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never)
    const service = new BudgetsService(db)
    const mockClaude = vi.fn().mockResolvedValue([])

    const result = await service.parse(BUDGET_ID, 'nic', [], mockClaude)
    expect(result).toEqual([])
  })

  it('throws when Claude call fails', async () => {
    const db = makeDb()
    const service = new BudgetsService(db)
    const mockClaude = vi.fn().mockRejectedValue(new Error('Claude API error'))

    await expect(service.parse(BUDGET_ID, 'text', [], mockClaude)).rejects.toThrow('Claude API error')
  })
})

describe('BudgetsService.recalcTotal', () => {
  it('sums item totalPrices and updates budget', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([
      { totalPrice: 1000 },
      { totalPrice: 2500 },
    ]) as never)
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never)
    const service = new BudgetsService(db)

    await service.recalcTotal(BUDGET_ID)

    const setSpy = vi.mocked(db.update).mock.results[0]?.value.set as ReturnType<typeof vi.fn>
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ totalWithoutVat: 3500 }))
  })
})

describe('BudgetsService.exportXlsx', () => {
  it('returns a non-empty Uint8Array', async () => {
    const db = makeDb()
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([mockBudget]) as never)
      .mockReturnValueOnce(selectChain([mockItem]) as never)
      .mockReturnValueOnce(selectChain([mockTranscript]) as never)
    const service = new BudgetsService(db)

    const buffer = await service.exportXlsx(COMPANY_ID, BUDGET_ID)
    expect(buffer).toBeInstanceOf(Uint8Array)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('throws when budget not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    const service = new BudgetsService(db)

    await expect(service.exportXlsx(COMPANY_ID, 'nonexistent')).rejects.toThrow()
  })
})
