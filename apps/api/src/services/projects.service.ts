import { eq, and, SQL } from 'drizzle-orm'
import { projects, projectPhotos, budgets } from '../db/schema.js'
import type { Db } from '../db/client.js'
import type { ProjectStatus } from '@kvalt/shared'

export type ProjectRow = typeof projects.$inferSelect
export type ProjectPhotoRow = typeof projectPhotos.$inferSelect

export interface ProjectDetail extends ProjectRow {
  photos: ProjectPhotoRow[]
  budgets: Array<{ id: string; name: string; totalWithoutVat: number; status: string }>
}

export interface CreateProjectInput {
  name: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  clientIco?: string
  address?: string
  plannedStart?: string
  plannedEnd?: string
  notes?: string
}

export const VALID_TRANSITIONS: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
  OFFER:       ['APPROVED', 'CANCELLED'],
  APPROVED:    ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['HANDOVER', 'CANCELLED'],
  HANDOVER:    ['INVOICED', 'IN_PROGRESS'],
  INVOICED:    ['PAID'],
}

export class ProjectsService {
  constructor(private db: Db) {}

  async create(companyId: string, input: CreateProjectInput): Promise<ProjectRow> {
    const [project] = await this.db
      .insert(projects)
      .values({ companyId, status: 'OFFER', ...input })
      .returning()

    if (!project) throw new Error('Failed to create project')
    return project
  }

  async list(
    companyId: string,
    opts?: { status?: ProjectStatus },
    page = { limit: 100, offset: 0 },
  ): Promise<ProjectRow[]> {
    const conditions: SQL[] = [eq(projects.companyId, companyId)]
    if (opts?.status) conditions.push(eq(projects.status, opts.status as never))

    return this.db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(projects.createdAt)
      .limit(page.limit)
      .offset(page.offset)
  }

  async getById(companyId: string, id: string): Promise<ProjectDetail | null> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.companyId, companyId)))
      .limit(1)

    if (!project) return null

    const photos = await this.db
      .select()
      .from(projectPhotos)
      .where(eq(projectPhotos.projectId, id))
      .orderBy(projectPhotos.createdAt)

    const budgetRows = await this.db
      .select({
        id: budgets.id,
        name: budgets.name,
        totalWithoutVat: budgets.totalWithoutVat,
        status: budgets.status,
      })
      .from(budgets)
      .where(eq(budgets.projectId, id))

    return { ...project, photos, budgets: budgetRows }
  }

  async update(companyId: string, id: string, input: Partial<CreateProjectInput>): Promise<ProjectRow> {
    const [updated] = await this.db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.companyId, companyId)))
      .returning()

    if (!updated) throw new Error('Project not found')
    return updated
  }

  async updateStatus(companyId: string, id: string, newStatus: ProjectStatus): Promise<ProjectRow> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.companyId, companyId)))
      .limit(1)

    if (!project) throw new Error('Project not found')

    const allowed = VALID_TRANSITIONS[project.status as ProjectStatus]
    if (!allowed?.includes(newStatus)) {
      throw new Error(`Invalid status transition: ${project.status} → ${newStatus}`)
    }

    const today = new Date().toISOString().slice(0, 10)
    const extra: Partial<ProjectRow> = {}
    if (newStatus === 'IN_PROGRESS' && !project.actualStart) extra.actualStart = today
    if (newStatus === 'HANDOVER' && !project.actualEnd) extra.actualEnd = today

    const [updated] = await this.db
      .update(projects)
      .set({ status: newStatus, ...extra, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.companyId, companyId)))
      .returning()

    if (!updated) throw new Error('Update failed')
    return updated
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.companyId, companyId)))
  }

  async addPhoto(projectId: string, storagePath: string, caption?: string): Promise<ProjectPhotoRow> {
    const [photo] = await this.db
      .insert(projectPhotos)
      .values({ projectId, storagePath, caption })
      .returning()

    if (!photo) throw new Error('Failed to save photo')
    return photo
  }

  async deletePhoto(projectId: string, photoId: string): Promise<void> {
    await this.db
      .delete(projectPhotos)
      .where(and(eq(projectPhotos.id, photoId), eq(projectPhotos.projectId, projectId)))
  }

  async linkBudget(companyId: string, projectId: string, budgetId: string): Promise<void> {
    await this.db
      .update(budgets)
      .set({ projectId, updatedAt: new Date() })
      .where(and(eq(budgets.id, budgetId), eq(budgets.companyId, companyId)))
  }
}
