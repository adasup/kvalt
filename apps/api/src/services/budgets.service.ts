import { eq, and, sum, desc } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { budgets, budgetItems, transcripts, priceListItems } from '../db/schema.js'
import type { Db } from '../db/client.js'
import type { ClaudeFn, PriceItemCompact, ParsedItem } from '../lib/claude.js'

export interface BudgetDetail {
  id: string
  companyId: string
  projectId: string | null
  name: string
  status: 'DRAFT' | 'DONE'
  vatRate: number
  totalWithoutVat: number
  createdAt: Date
  updatedAt: Date
  items: BudgetItemRow[]
  transcripts: TranscriptRow[]
}

export type BudgetRow = typeof budgets.$inferSelect
export type BudgetItemRow = typeof budgetItems.$inferSelect
export type TranscriptRow = typeof transcripts.$inferSelect

export interface CreateBudgetInput {
  name: string
  projectId?: string
  vatRate?: number
}

export class BudgetsService {
  constructor(private db: Db) {}

  async create(companyId: string, input: CreateBudgetInput): Promise<BudgetRow> {
    const [budget] = await this.db
      .insert(budgets)
      .values({
        companyId,
        projectId: input.projectId,
        name: input.name,
        status: 'DRAFT',
        vatRate: input.vatRate ?? 21,
        totalWithoutVat: 0,
      })
      .returning()

    if (!budget) throw new Error('Failed to create budget')
    return budget
  }

  async list(companyId: string): Promise<BudgetRow[]> {
    return this.db
      .select()
      .from(budgets)
      .where(eq(budgets.companyId, companyId))
      .orderBy(budgets.createdAt)
  }

  async getById(companyId: string, id: string): Promise<BudgetDetail | null> {
    const [budget] = await this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.companyId, companyId)))
      .limit(1)

    if (!budget) return null

    const items = await this.db
      .select()
      .from(budgetItems)
      .where(eq(budgetItems.budgetId, id))
      .orderBy(budgetItems.sortOrder)

    const transcriptRows = await this.db
      .select()
      .from(transcripts)
      .where(eq(transcripts.budgetId, id))
      .orderBy(transcripts.createdAt)

    return { ...budget, items, transcripts: transcriptRows }
  }

  async update(companyId: string, id: string, input: Partial<CreateBudgetInput> & { status?: 'DRAFT' | 'DONE' }): Promise<BudgetRow> {
    const [updated] = await this.db
      .update(budgets)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(budgets.id, id), eq(budgets.companyId, companyId)))
      .returning()

    if (!updated) throw new Error('Budget not found')
    return updated
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.companyId, companyId)))
  }

  async addTranscript(budgetId: string, text: string): Promise<TranscriptRow> {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length

    const [transcript] = await this.db
      .insert(transcripts)
      .values({ budgetId, text, wordCount })
      .returning()

    if (!transcript) throw new Error('Failed to save transcript')
    return transcript
  }

  async parse(
    budgetId: string,
    text: string,
    priceItems: PriceItemCompact[],
    claudeFn: ClaudeFn,
  ): Promise<BudgetItemRow[]> {
    const parsed: ParsedItem[] = await claudeFn(text, priceItems)
    if (parsed.length === 0) return []

    const rows = await this.db
      .insert(budgetItems)
      .values(
        parsed.map((item, i) => ({
          budgetId,
          name: item.name,
          rawText: item.rawText,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          matchType: item.matchType,
          matchedPriceItem: item.matchedPriceItem,
          category: item.category,
          sortOrder: i,
        })),
      )
      .returning()

    await this.recalcTotal(budgetId)
    return rows
  }

  async addItem(
    budgetId: string,
    item: Omit<ParsedItem, 'matchType'> & { matchType?: 'MATCHED' | 'ESTIMATED' | 'MANUAL' },
  ): Promise<BudgetItemRow> {
    const [existing] = await this.db
      .select({ sortOrder: budgetItems.sortOrder })
      .from(budgetItems)
      .where(eq(budgetItems.budgetId, budgetId))
      .orderBy(desc(budgetItems.sortOrder))

    const nextOrder = existing ? (existing.sortOrder ?? 0) + 1 : 0

    const [row] = await this.db
      .insert(budgetItems)
      .values({ ...item, budgetId, matchType: item.matchType ?? 'MANUAL', sortOrder: nextOrder })
      .returning()

    if (!row) throw new Error('Failed to add item')
    await this.recalcTotal(budgetId)
    return row
  }

  async updateItem(budgetId: string, itemId: string, input: Partial<ParsedItem>): Promise<BudgetItemRow> {
    const [row] = await this.db
      .update(budgetItems)
      .set(input)
      .where(and(eq(budgetItems.id, itemId), eq(budgetItems.budgetId, budgetId)))
      .returning()

    if (!row) throw new Error('Item not found')
    await this.recalcTotal(budgetId)
    return row
  }

  async deleteItem(budgetId: string, itemId: string): Promise<void> {
    await this.db
      .delete(budgetItems)
      .where(and(eq(budgetItems.id, itemId), eq(budgetItems.budgetId, budgetId)))
    await this.recalcTotal(budgetId)
  }

  async recalcTotal(budgetId: string): Promise<void> {
    const rows = await this.db
      .select({ totalPrice: budgetItems.totalPrice })
      .from(budgetItems)
      .where(eq(budgetItems.budgetId, budgetId))

    const total = rows.reduce((acc, r) => acc + (r.totalPrice ?? 0), 0)

    await this.db
      .update(budgets)
      .set({ totalWithoutVat: total, updatedAt: new Date() })
      .where(eq(budgets.id, budgetId))
  }

  async exportXlsx(companyId: string, id: string): Promise<Uint8Array> {
    const detail = await this.getById(companyId, id)
    if (!detail) throw new Error('Budget not found')

    const wb = XLSX.utils.book_new()

    // Položky sheet
    const itemRows = [
      ['#', 'Název', 'Surový text', 'MJ', 'Množství', 'Cena/MJ', 'Celkem', 'Shoda', 'Kategorie'],
      ...detail.items.map((item, i) => [
        i + 1,
        item.name,
        item.rawText ?? '',
        item.unit,
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        item.matchType,
        item.category ?? '',
      ]),
      [],
      ['', '', '', '', '', 'Celkem bez DPH:', detail.totalWithoutVat],
      ['', '', '', '', '', `DPH ${detail.vatRate}%:`, Math.round(detail.totalWithoutVat * (detail.vatRate / 100))],
      ['', '', '', '', '', 'Celkem s DPH:', Math.round(detail.totalWithoutVat * (1 + detail.vatRate / 100))],
    ]

    const ws = XLSX.utils.aoa_to_sheet(itemRows)
    ws['!cols'] = [
      { wch: 4 }, { wch: 40 }, { wch: 30 }, { wch: 8 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Položky')

    // Přepisy sheet
    if (detail.transcripts.length > 0) {
      const trRows = [
        ['Datum', 'Počet slov', 'Text'],
        ...detail.transcripts.map((t) => [
          t.createdAt instanceof Date ? t.createdAt.toISOString().slice(0, 10) : String(t.createdAt),
          t.wordCount,
          t.text,
        ]),
      ]
      const wsTr = XLSX.utils.aoa_to_sheet(trRows)
      XLSX.utils.book_append_sheet(wb, wsTr, 'Přepisy')
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    return new Uint8Array(buffer)
  }

  async exportPdfHtml(companyId: string, id: string): Promise<string> {
    const detail = await this.getById(companyId, id)
    if (!detail) throw new Error('Budget not found')

    const vatAmount = Math.round(detail.totalWithoutVat * (detail.vatRate / 100))
    const totalWithVat = Math.round(detail.totalWithoutVat * (1 + detail.vatRate / 100))

    const rows = detail.items
      .map(
        (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(item.name)}</td>
        <td>${esc(item.unit)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${item.unitPrice.toLocaleString('cs-CZ')}</td>
        <td class="num">${item.totalPrice.toLocaleString('cs-CZ')}</td>
      </tr>`,
      )
      .join('')

    return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20mm; }
  h1 { font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #e5e7eb; text-align: left; padding: 4px 6px; border: 1px solid #9ca3af; }
  td { padding: 3px 6px; border: 1px solid #d1d5db; }
  .num { text-align: right; }
  .total { font-weight: bold; text-align: right; margin-top: 8px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>${esc(detail.name)}</h1>
<table>
  <thead><tr><th>#</th><th>Název</th><th>MJ</th><th>Množství</th><th>Cena/MJ</th><th>Celkem</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="total">Celkem bez DPH: ${detail.totalWithoutVat.toLocaleString('cs-CZ')} Kč</div>
<div class="total">DPH ${detail.vatRate}%: ${vatAmount.toLocaleString('cs-CZ')} Kč</div>
<div class="total">Celkem s DPH: ${totalWithVat.toLocaleString('cs-CZ')} Kč</div>
</body></html>`
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
