import { eq, and, desc } from 'drizzle-orm'
import { diaryEntries, diaryPhotos, extraWorks } from '../db/schema.js'
import type { Db } from '../db/client.js'

export type DiaryEntryRow = typeof diaryEntries.$inferSelect
export type DiaryPhotoRow = typeof diaryPhotos.$inferSelect
export type ExtraWorkRow = typeof extraWorks.$inferSelect

export type DiaryClaudeFn = (rawText: string) => Promise<string>

export class DiaryService {
  constructor(private db: Db) {}

  async create(input: {
    projectId: string
    authorId: string
    date: string
    description: string
    weather?: string
    temperature?: number
    workersPresent?: number
  }): Promise<DiaryEntryRow> {
    const [entry] = await this.db
      .insert(diaryEntries)
      .values({
        projectId: input.projectId,
        authorId: input.authorId,
        date: input.date,
        description: input.description,
        weather: input.weather,
        temperature: input.temperature,
        workersPresent: input.workersPresent ?? 0,
      })
      .returning()

    if (!entry) throw new Error('Failed to create diary entry')
    return entry
  }

  async list(projectId: string): Promise<DiaryEntryRow[]> {
    return this.db
      .select()
      .from(diaryEntries)
      .where(eq(diaryEntries.projectId, projectId))
      .orderBy(desc(diaryEntries.date))
  }

  async getById(
    entryId: string,
    projectId: string,
  ): Promise<{ entry: DiaryEntryRow; photos: DiaryPhotoRow[] } | null> {
    const [entry] = await this.db
      .select()
      .from(diaryEntries)
      .where(and(eq(diaryEntries.id, entryId), eq(diaryEntries.projectId, projectId)))
      .limit(1)

    if (!entry) return null

    const photos = await this.db
      .select()
      .from(diaryPhotos)
      .where(eq(diaryPhotos.diaryEntryId, entryId))

    return { entry, photos }
  }

  async update(
    entryId: string,
    input: Partial<Pick<DiaryEntryRow, 'description' | 'weather' | 'temperature' | 'workersPresent'>>,
  ): Promise<DiaryEntryRow> {
    const [updated] = await this.db
      .update(diaryEntries)
      .set(input)
      .where(eq(diaryEntries.id, entryId))
      .returning()

    if (!updated) throw new Error('Diary entry not found')
    return updated
  }

  async delete(entryId: string): Promise<void> {
    await this.db.delete(diaryEntries).where(eq(diaryEntries.id, entryId))
  }

  async addPhoto(entryId: string, storagePath: string, caption?: string): Promise<DiaryPhotoRow> {
    const [photo] = await this.db
      .insert(diaryPhotos)
      .values({ diaryEntryId: entryId, storagePath, caption })
      .returning()

    if (!photo) throw new Error('Failed to insert photo')
    return photo
  }

  async deletePhoto(photoId: string): Promise<string> {
    const [photo] = await this.db
      .select()
      .from(diaryPhotos)
      .where(eq(diaryPhotos.id, photoId))
      .limit(1)

    if (!photo) throw new Error('Photo not found')

    await this.db.delete(diaryPhotos).where(eq(diaryPhotos.id, photoId))
    return photo.storagePath
  }

  async addExtraWork(input: {
    projectId: string
    description: string
    scope?: string
    estimatedPrice?: number
  }): Promise<ExtraWorkRow> {
    const [work] = await this.db
      .insert(extraWorks)
      .values({
        projectId: input.projectId,
        description: input.description,
        scope: input.scope,
        estimatedPrice: input.estimatedPrice,
      })
      .returning()

    if (!work) throw new Error('Failed to insert extra work')
    return work
  }

  async listExtraWorks(projectId: string): Promise<ExtraWorkRow[]> {
    return this.db
      .select()
      .from(extraWorks)
      .where(eq(extraWorks.projectId, projectId))
      .orderBy(extraWorks.createdAt)
  }

  async approveExtraWork(extraWorkId: string): Promise<void> {
    await this.db
      .update(extraWorks)
      .set({ approvedByClient: true })
      .where(eq(extraWorks.id, extraWorkId))
  }

  async structureWithAI(rawText: string, claudeFn: DiaryClaudeFn): Promise<string> {
    try {
      return await claudeFn(rawText)
    } catch {
      return rawText
    }
  }
}
