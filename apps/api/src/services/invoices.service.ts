import { eq, and, desc } from 'drizzle-orm'
import { invoices, invoiceItems, budgets, budgetItems, projects } from '../db/schema.js'
import type { Db } from '../db/client.js'

export type InvoiceRow = typeof invoices.$inferSelect
export type InvoiceItemRow = typeof invoiceItems.$inferSelect
export type InvoiceStatus = InvoiceRow['status']
export type InvoiceType = InvoiceRow['type']

// ─── Pure helper: Czech QR Platba (SPAYD) ────────────────────────────────────

export function generateQrPayload(input: {
  iban: string
  amount: number
  variableSymbol: string
  message: string
}): string {
  const parts = [
    'SPD*1.0',
    `ACC:${input.iban}`,
    `AM:${input.amount.toFixed(2)}`,
    'CC:CZK',
    `X-VS:${input.variableSymbol}`,
    `MSG:${input.message}`,
  ]
  return parts.join('*')
}

// ─── Status transition guard ──────────────────────────────────────────────────

const INVOICE_TRANSITIONS: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
  DRAFT: ['ISSUED'],
  ISSUED: ['PAID', 'OVERDUE'],
  OVERDUE: ['PAID'],
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class InvoiceService {
  constructor(private db: Db) {}

  async create(input: {
    companyId: string
    projectId?: string
    invoiceNumber: string
    type: InvoiceType
    dateIssued: string
    dateDue: string
    totalWithoutVat: number
    vatAmount: number
    totalWithVat: number
    clientName: string
    clientAddress?: string
    clientIco?: string
    clientDic?: string
  }): Promise<InvoiceRow> {
    const [invoice] = await this.db.insert(invoices).values(input).returning()
    if (!invoice) throw new Error('Failed to create invoice')
    return invoice
  }

  async createFromBudget(
    budgetId: string,
    input: {
      invoiceNumber: string
      type: InvoiceType
      dateIssued: string
      dateDue: string
    },
  ): Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] }> {
    const [budget] = await this.db
      .select()
      .from(budgets)
      .where(eq(budgets.id, budgetId))
      .limit(1)

    if (!budget) throw new Error('Budget not found')

    const items = await this.db
      .select()
      .from(budgetItems)
      .where(eq(budgetItems.budgetId, budgetId))

    const [project] = await this.db
      .select({
        name: projects.name,
        clientName: projects.clientName,
        clientAddress: projects.address,
        clientIco: projects.clientIco,
      })
      .from(projects)
      .where(eq(projects.id, budget.projectId!))
      .limit(1)

    const vatAmount = budget.totalWithoutVat * (budget.vatRate / 100)
    const totalWithVat = budget.totalWithoutVat + vatAmount

    const [invoice] = await this.db
      .insert(invoices)
      .values({
        companyId: budget.companyId,
        projectId: budget.projectId ?? undefined,
        invoiceNumber: input.invoiceNumber,
        type: input.type,
        dateIssued: input.dateIssued,
        dateDue: input.dateDue,
        totalWithoutVat: budget.totalWithoutVat,
        vatAmount,
        totalWithVat,
        clientName: project?.clientName ?? project?.name ?? '',
        clientAddress: project?.clientAddress ?? undefined,
        clientIco: project?.clientIco ?? undefined,
      })
      .returning()

    if (!invoice) throw new Error('Failed to create invoice')

    const insertedItems = await this.db
      .insert(invoiceItems)
      .values(
        items.map((item) => ({
          invoiceId: invoice.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          vatRate: budget.vatRate,
          totalPrice: item.totalPrice,
        })),
      )
      .returning()

    return { invoice, items: insertedItems }
  }

  async list(companyId: string): Promise<InvoiceRow[]> {
    return this.db
      .select()
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .orderBy(desc(invoices.dateIssued))
  }

  async getById(
    invoiceId: string,
    companyId: string,
  ): Promise<{ invoice: InvoiceRow; items: InvoiceItemRow[] } | null> {
    const [invoice] = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1)

    if (!invoice) return null

    const items = await this.db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId))

    return { invoice, items }
  }

  async updateStatus(invoiceId: string, status: InvoiceStatus): Promise<InvoiceRow> {
    const [current] = await this.db
      .select({ status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)

    if (!current) throw new Error('Invoice not found')

    const allowed = INVOICE_TRANSITIONS[current.status]
    if (!allowed?.includes(status)) {
      throw new Error(`Invalid status transition: ${current.status} → ${status}`)
    }

    const patch: Partial<InvoiceRow> = { status }
    if (status === 'PAID') patch.datePaid = new Date().toISOString().slice(0, 10)

    const [updated] = await this.db
      .update(invoices)
      .set(patch)
      .where(eq(invoices.id, invoiceId))
      .returning()

    if (!updated) throw new Error('Invoice not found')
    return updated
  }
}
