import { describe, it, expect, vi } from 'vitest'
import { InvoiceService, generateQrPayload } from './invoices.service.js'
import type { Db } from '../db/client.js'

// ─── DB mock helpers ──────────────────────────────────────────────────────────

function returning(rows: unknown[]) {
  return { returning: vi.fn().mockResolvedValue(rows) }
}

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

function updateChain(returned: unknown[] = []) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(returned) }),
    }),
  }
}

function deleteChain() {
  return { where: vi.fn().mockResolvedValue(undefined) }
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

const mockInvoice = {
  id: 'inv-1',
  companyId: 'company-1',
  projectId: 'project-1',
  invoiceNumber: '2026001',
  type: 'FINAL' as const,
  dateIssued: '2026-04-21',
  dateDue: '2026-05-05',
  datePaid: null,
  totalWithoutVat: 100000,
  vatAmount: 21000,
  totalWithVat: 121000,
  status: 'DRAFT' as const,
  clientName: 'Jan Novák',
  clientAddress: 'Hlavní 1, Praha',
  clientIco: '12345678',
  clientDic: null,
  pdfStoragePath: null,
  createdAt: new Date(),
}

const mockItem = {
  id: 'item-1',
  invoiceId: 'inv-1',
  name: 'Bourání příček',
  quantity: 50,
  unit: 'm2',
  unitPrice: 2000,
  vatRate: 21,
  totalPrice: 100000,
}

const mockBudget = {
  id: 'budget-1',
  companyId: 'company-1',
  projectId: 'project-1',
  name: 'Rozpočet Novákovi',
  status: 'DONE' as const,
  vatRate: 21,
  totalWithoutVat: 100000,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockBudgetItem = {
  id: 'bitem-1',
  budgetId: 'budget-1',
  name: 'Bourání příček',
  rawText: null,
  unit: 'm2',
  quantity: 50,
  unitPrice: 2000,
  totalPrice: 100000,
  matchType: 'MATCHED' as const,
  matchedPriceItem: null,
  category: null,
  sortOrder: 0,
}

// ─── Tests: generateQrPayload ─────────────────────────────────────────────────

describe('generateQrPayload', () => {
  it('includes SPD header and account', () => {
    const qr = generateQrPayload({ iban: 'CZ6508000000192000145399', amount: 121000, variableSymbol: '2026001', message: 'Faktura 2026001' })
    expect(qr).toContain('SPD*1.0')
    expect(qr).toContain('CZ6508000000192000145399')
  })

  it('includes amount formatted to 2 decimal places', () => {
    const qr = generateQrPayload({ iban: 'CZ65...', amount: 121000, variableSymbol: '2026001', message: '' })
    expect(qr).toContain('AM:121000.00')
  })

  it('includes variable symbol', () => {
    const qr = generateQrPayload({ iban: 'CZ65...', amount: 5000, variableSymbol: '20260042', message: '' })
    expect(qr).toContain('X-VS:20260042')
  })

  it('includes currency CZK', () => {
    const qr = generateQrPayload({ iban: 'CZ65...', amount: 1, variableSymbol: '1', message: '' })
    expect(qr).toContain('CC:CZK')
  })
})

// ─── Tests: InvoiceService.create ────────────────────────────────────────────

describe('InvoiceService.create', () => {
  it('inserts invoice and returns it', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([mockInvoice])) } as never)
    const service = new InvoiceService(db)

    const result = await service.create({
      companyId: 'company-1',
      projectId: 'project-1',
      invoiceNumber: '2026001',
      type: 'FINAL',
      dateIssued: '2026-04-21',
      dateDue: '2026-05-05',
      totalWithoutVat: 100000,
      vatAmount: 21000,
      totalWithVat: 121000,
      clientName: 'Jan Novák',
    })

    expect(result.invoiceNumber).toBe('2026001')
    expect(result.totalWithVat).toBe(121000)
  })

  it('throws if insert returns nothing', async () => {
    const db = makeDb()
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockReturnValue(returning([])) } as never)

    await expect(
      new InvoiceService(db).create({
        companyId: 'c', projectId: 'p', invoiceNumber: '1', type: 'FINAL',
        dateIssued: '2026-04-21', dateDue: '2026-04-30',
        totalWithoutVat: 0, vatAmount: 0, totalWithVat: 0, clientName: 'X',
      }),
    ).rejects.toThrow('Failed to create')
  })
})

// ─── Tests: InvoiceService.createFromBudget ───────────────────────────────────

describe('InvoiceService.createFromBudget', () => {
  it('creates invoice with items copied from budget', async () => {
    const db = makeDb()
    // select budget, select budget items, select project, insert invoice, insert items
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([mockBudget]) as never)     // budget
      .mockReturnValueOnce(selectChain([mockBudgetItem]) as never)  // budget items
      .mockReturnValueOnce(selectChain([{ name: 'Novákovi', clientName: 'Jan Novák', clientAddress: 'Hlavní 1', clientIco: '12345678', clientDic: null }]) as never) // project

    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: vi.fn().mockReturnValue(returning([mockInvoice])) } as never)  // invoice
      .mockReturnValueOnce({ values: vi.fn().mockReturnValue(returning([mockItem])) } as never)     // items

    const service = new InvoiceService(db)
    const result = await service.createFromBudget('budget-1', {
      invoiceNumber: '2026001',
      type: 'FINAL',
      dateIssued: '2026-04-21',
      dateDue: '2026-05-05',
    })

    expect(result.invoice.totalWithVat).toBe(121000)
    expect(result.items).toHaveLength(1)
  })

  it('throws when budget not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)

    await expect(
      new InvoiceService(db).createFromBudget('missing', {
        invoiceNumber: '1', type: 'FINAL', dateIssued: '2026-04-21', dateDue: '2026-04-30',
      }),
    ).rejects.toThrow('Budget not found')
  })
})

// ─── Tests: InvoiceService.list ───────────────────────────────────────────────

describe('InvoiceService.list', () => {
  it('returns invoices for company ordered by date', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([mockInvoice]) as never)

    const result = await new InvoiceService(db).list('company-1')
    expect(result).toHaveLength(1)
    expect(result[0]?.companyId).toBe('company-1')
  })
})

// ─── Tests: InvoiceService.getById ────────────────────────────────────────────

describe('InvoiceService.getById', () => {
  it('returns invoice with items', async () => {
    const db = makeDb()
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([mockInvoice]) as never)
      .mockReturnValueOnce(selectChain([mockItem]) as never)

    const result = await new InvoiceService(db).getById('inv-1', 'company-1')
    expect(result?.invoice.id).toBe('inv-1')
    expect(result?.items).toHaveLength(1)
  })

  it('returns null when not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValue(selectChain([]) as never)

    const result = await new InvoiceService(db).getById('missing', 'company-1')
    expect(result).toBeNull()
  })
})

// ─── Tests: InvoiceService.updateStatus ──────────────────────────────────────

describe('InvoiceService.updateStatus', () => {
  it('transitions DRAFT → ISSUED', async () => {
    const db = makeDb()
    const issued = { ...mockInvoice, status: 'ISSUED' as const }
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ status: 'DRAFT' }]) as never)
    vi.mocked(db.update).mockReturnValue(updateChain([issued]) as never)

    const result = await new InvoiceService(db).updateStatus('inv-1', 'ISSUED')
    expect(result.status).toBe('ISSUED')
  })

  it('throws on invalid transition', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ status: 'DRAFT' }]) as never)

    await expect(new InvoiceService(db).updateStatus('inv-1', 'PAID')).rejects.toThrow('Invalid status transition')
  })

  it('sets datePaid when transitioning to PAID', async () => {
    const db = makeDb()
    const paid = { ...mockInvoice, status: 'PAID' as const, datePaid: '2026-04-30' }
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ status: 'ISSUED' }]) as never)
    vi.mocked(db.update).mockReturnValue(updateChain([paid]) as never)

    const result = await new InvoiceService(db).updateStatus('inv-1', 'PAID')
    expect(result.status).toBe('PAID')
    // update should have been called with datePaid set
    const setArg = vi.mocked(db.update).mock.results[0]?.value.set.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg?.datePaid).toBeDefined()
  })

  it('throws when invoice not found', async () => {
    const db = makeDb()
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)

    await expect(new InvoiceService(db).updateStatus('missing', 'ISSUED')).rejects.toThrow('not found')
  })
})
