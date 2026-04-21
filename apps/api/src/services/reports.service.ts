import { eq, and, gte, lte, sum } from 'drizzle-orm'
import { invoices, attendance, users } from '../db/schema.js'
import type { Db } from '../db/client.js'

export interface ProfitabilityResult {
  revenue: number
  labourCost: number
  profit: number
  margin: number
}

export interface EmployeeEarnings {
  userId: string
  fullName: string
  totalHours: number
  totalEarnings: number
}

export class ReportsService {
  constructor(private db: Db) {}

  async projectProfitability(projectId: string): Promise<ProfitabilityResult> {
    const [revenueRow] = await this.db
      .select({ revenue: sum(invoices.totalWithVat) })
      .from(invoices)
      .where(eq(invoices.projectId, projectId))

    const [costRow] = await this.db
      .select({ labourCost: sum(attendance.earnings) })
      .from(attendance)
      .where(eq(attendance.projectId, projectId))

    const revenue = Number(revenueRow?.revenue ?? 0)
    const labourCost = Number(costRow?.labourCost ?? 0)
    const profit = revenue - labourCost
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0

    return { revenue, labourCost, profit, margin }
  }

  async monthlyEarnings(companyId: string, yearMonth: string): Promise<EmployeeEarnings[]> {
    const from = `${yearMonth}-01`
    const to = `${yearMonth}-31`

    const rows = await this.db
      .select({
        userId: users.id,
        fullName: users.fullName,
        totalHours: sum(attendance.hoursWorked),
        totalEarnings: sum(attendance.earnings),
      })
      .from(attendance)
      .innerJoin(users, eq(attendance.userId, users.id))
      .where(
        and(
          eq(users.companyId, companyId),
          gte(attendance.date, from),
          lte(attendance.date, to),
        ),
      )
      .orderBy(users.fullName)

    return rows.map((r) => ({
      userId: r.userId,
      fullName: r.fullName,
      totalHours: Number(r.totalHours ?? 0),
      totalEarnings: Number(r.totalEarnings ?? 0),
    }))
  }
}
